import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SecurityLogger } from './security.logger';

const SAFE_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Request validation failed.': 'Falha na validação da requisição.',
  'Authentication required': 'Autenticação obrigatória.',
  'Activation token is invalid or expired': 'O token de ativação é inválido ou expirou.',
  'Account cannot be activated': 'A conta não pode ser ativada.',
  'Platform access requires Super Admin': 'O acesso à plataforma exige um Super Admin.',
  'Organization Admin access required': 'É necessário ser Organization Admin.',
  'Organization not found': 'Organization não encontrada.',
  'Organization or admin already exists': 'A Organization ou o administrador já existe.',
  'Organization document already exists': 'O documento da Organization já existe.',
  'User email already exists': 'O e-mail do usuário já existe.',
  'User not found': 'Usuário não encontrado.',
  'Customer not found': 'Customer não encontrado.',
  'Customer or Vehicle not found': 'Customer ou Vehicle não encontrado.',
  'Customer document already exists in this Organization': 'O documento do Customer já existe nesta Organization.',
  'Vehicle not found': 'Vehicle não encontrado.',
  'Vehicle plate already exists in this Organization': 'A placa do Vehicle já existe nesta Organization.',
  'Service not found': 'Service não encontrado.',
  'Active Service not found': 'Service ativo não encontrado.',
  'Product not found': 'Produto não encontrado.',
  'Active Product not found': 'Produto ativo não encontrado.',
  'Product SKU already exists in this Organization': 'O SKU do produto já existe nesta Organization.',
  'Quote not found': 'Quote não encontrado.',
  'Quote Item not found': 'Item do Quote não encontrado.',
  'Quote number already exists in this Organization': 'O número do Quote já existe nesta Organization.',
  'Only draft Quotes can be edited': 'Apenas Quotes em rascunho podem ser editados.',
  'SERVICE requires only serviceId': 'SERVICE exige apenas serviceId.',
  'PRODUCT requires only productId': 'PRODUCT exige apenas productId.',
  'MANUAL requires description and unitPrice': 'MANUAL exige descrição e unitPrice.',
  'Work Order not found': 'Work Order não encontrada.',
  'Work Order Item not found': 'Item da Work Order não encontrado.',
  'Historical Work Orders cannot be edited': 'Work Orders históricas não podem ser editadas.',
  'Payment not found': 'Pagamento não encontrado.',
  'Payment is already cancelled.': 'O pagamento já está cancelado.',
};

const SAFE_CODES = new Set([
  'QUOTE_INVALID_TRANSITION',
  'QUOTE_NOT_APPROVED',
  'QUOTE_ALREADY_CONVERTED',
  'WORK_ORDER_INVALID_TRANSITION',
  'WORK_ORDER_CANCELLED',
  'PAYMENT_EXCEEDS_BALANCE',
  'PAYMENT_ALREADY_CANCELLED',
]);

const SAFE_CODE_DETAILS: Record<string, string> = {
  QUOTE_INVALID_TRANSITION: 'A transição solicitada para o Quote não é permitida.',
  QUOTE_NOT_APPROVED: 'Apenas Quotes aprovados podem ser convertidos em Work Orders.',
  QUOTE_ALREADY_CONVERTED: 'Este Quote já foi convertido em uma Work Order.',
  WORK_ORDER_INVALID_TRANSITION: 'A transição solicitada para a Work Order não é permitida.',
  WORK_ORDER_CANCELLED: 'Work Orders canceladas não podem receber pagamentos.',
  PAYMENT_EXCEEDS_BALANCE: 'O pagamento excede o saldo da ordem de serviço.',
  PAYMENT_ALREADY_CANCELLED: 'O pagamento já está cancelado.',
};

const TITLES: Record<number, string> = {
  400: 'Requisição inválida', 401: 'Não autenticado', 403: 'Acesso negado',
  404: 'Recurso não encontrado', 409: 'Conflito', 429: 'Muitas solicitações',
  500: 'Erro interno do servidor',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly securityLogger = new SecurityLogger()) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isLogin = request.path.endsWith('/auth/login');
    const detail = exception instanceof HttpException && status < 500
      ? isLogin ? this.loginDetail(exception) : this.safeDetail(exception)
      : isLogin ? 'An unexpected error occurred.' : 'Ocorreu um erro inesperado.';

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const customProblem = typeof exceptionResponse === 'object' && exceptionResponse !== null
      ? exceptionResponse as Record<string, unknown>
      : {};
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN || status === HttpStatus.TOO_MANY_REQUESTS || status >= 500) {
      this.securityLogger.record({
        event: status === HttpStatus.FORBIDDEN
          ? 'authorization.failure'
          : status === HttpStatus.TOO_MANY_REQUESTS
            ? 'rate_limit.failure'
            : status >= 500 ? 'request.failure' : 'authentication.failure',
        method: request.method,
        path: request.route?.path ?? request.path,
        status,
        code: this.safeCode(customProblem.code, status),
      });
    }
    response.status(status).type('application/problem+json').json({
      type: `https://api.autohub.local/problems/${status}`,
      title: TITLES[status] ?? 'Erro',
      status,
      detail,
      instance: request.url,
      code: this.safeCode(customProblem.code, status),
    });
  }

  private safeDetail(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();
    if (exception.getStatus() === HttpStatus.BAD_REQUEST && typeof exceptionResponse !== 'string') {
      return 'Falha na validação da requisição.';
    }
    if (typeof exceptionResponse === 'string' && SAFE_MESSAGE_TRANSLATIONS[exceptionResponse]) return SAFE_MESSAGE_TRANSLATIONS[exceptionResponse];
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const code = (exceptionResponse as Record<string, unknown>).code;
      if (typeof code === 'string' && SAFE_CODES.has(code)) return SAFE_CODE_DETAILS[code];
    }
    return 'Não foi possível concluir a solicitação.';
  }

  private loginDetail(exception: HttpException): string {
    const response = exception.getResponse();
    if (exception.getStatus() === HttpStatus.BAD_REQUEST && typeof response !== 'string') return 'Request validation failed.';
    if (typeof response === 'string' && ['Authentication required', 'Invalid credentials'].includes(response)) return response;
    return 'The request could not be completed.';
  }

  private safeCode(code: unknown, status: number): string {
    return typeof code === 'string' && SAFE_CODES.has(code) ? code : `HTTP_${status}`;
  }
}
