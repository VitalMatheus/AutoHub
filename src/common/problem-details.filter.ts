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
  'Organization Admin access required': 'É necessário ser administrador da oficina.',
  'Organization not found': 'Oficina não encontrada.',
  'Organization or admin already exists': 'A oficina ou o administrador já existe.',
  'Organization document already exists': 'O documento da oficina já existe.',
  'User email already exists': 'O e-mail do usuário já existe.',
  'User not found': 'Usuário não encontrado.',
  'Customer not found': 'Cliente não encontrado.',
  'Customer or Vehicle not found': 'Cliente ou veículo não encontrado.',
  'Customer document already exists in this Organization': 'O documento do cliente já existe nesta oficina.',
  'Vehicle not found': 'Veículo não encontrado.',
  'Vehicle plate already exists in this Organization': 'A placa do veículo já existe nesta oficina.',
  'Service not found': 'Serviço não encontrado.',
  'Active Service not found': 'Serviço ativo não encontrado.',
  'Product not found': 'Produto não encontrado.',
  'Active Product not found': 'Produto ativo não encontrado.',
  'Product SKU already exists in this Organization': 'O SKU do produto já existe nesta oficina.',
  'Quote not found': 'Orçamento não encontrado.',
  'Quote Item not found': 'Item do orçamento não encontrado.',
  'Quote number already exists in this Organization': 'O número do orçamento já existe nesta oficina.',
  'Only draft Quotes can be edited': 'Apenas orçamentos em rascunho podem ser editados.',
  'SERVICE requires only serviceId': 'Serviço exige apenas um identificador de serviço.',
  'PRODUCT requires only productId': 'Produto exige apenas um identificador de produto.',
  'MANUAL requires description and unitPrice': 'Item manual exige descrição e preço unitário.',
  'Work Order not found': 'Ordem de serviço não encontrada.',
  'Work Order Item not found': 'Item da ordem de serviço não encontrado.',
  'Historical Work Orders cannot be edited': 'Ordens de serviço históricas não podem ser editadas.',
  'Product quantities must be whole numbers to consume stock': 'As quantidades de Product devem ser números inteiros para baixar estoque.',
  'Stock adjustment would make the Product stock negative': 'O ajuste deixaria o estoque do Product negativo.',
  'Payment not found': 'Pagamento não encontrado.',
  'Payment is already cancelled.': 'O pagamento já está cancelado.',
  'Only approved Quotes can be converted into Work Orders.': 'Apenas orçamentos aprovados podem ser convertidos em ordens de serviço.',
  'An approved Quote can generate only one Work Order.': 'Um orçamento aprovado pode gerar apenas uma ordem de serviço.',
  'Work Order cannot complete from OPEN.': 'A transição solicitada para a ordem de serviço não é permitida.',
  'Reason is required': 'O motivo é obrigatório.',
};

const SAFE_CODES = new Set([
  'QUOTE_INVALID_TRANSITION',
  'QUOTE_NOT_APPROVED',
  'QUOTE_ALREADY_CONVERTED',
  'WORK_ORDER_INVALID_TRANSITION',
  'WORK_ORDER_CANCELLED',
  'PAYMENT_EXCEEDS_BALANCE',
  'EXPENSE_PAYMENT_EXCEEDS_BALANCE',
  'EXPENSE_CANCELLED',
  'EXPENSE_HAS_CONFIRMED_PAYMENTS',
  'EXPENSE_AMOUNT_BELOW_PAYMENTS',
  'EXPENSE_PAYMENT_DATE_REQUIRED',
  'EXPENSE_PAYMENT_ALREADY_CANCELLED',
  'PAYMENT_ALREADY_CANCELLED',
  'COMMERCIAL_ACCESS_BLOCKED',
  'ORGANIZATION_OPERATIONAL_BLOCKED',
  'INSUFFICIENT_STOCK',
  'ORGANIZATION_INVALID_TRANSITION',
]);

const SAFE_CODE_DETAILS: Record<string, string> = {
  QUOTE_INVALID_TRANSITION: 'A transição solicitada para o orçamento não é permitida.',
  QUOTE_NOT_APPROVED: 'Apenas orçamentos aprovados podem ser convertidos em ordens de serviço.',
  QUOTE_ALREADY_CONVERTED: 'Este orçamento já foi convertido em uma ordem de serviço.',
  WORK_ORDER_INVALID_TRANSITION: 'A transição solicitada para a ordem de serviço não é permitida.',
  WORK_ORDER_CANCELLED: 'Ordens de serviço canceladas não podem receber pagamentos.',
  PAYMENT_EXCEEDS_BALANCE: 'O pagamento excede o saldo da ordem de serviço.',
  PAYMENT_ALREADY_CANCELLED: 'O pagamento já está cancelado.',
  EXPENSE_PAYMENT_EXCEEDS_BALANCE: 'A baixa excede o saldo da despesa.',
  EXPENSE_CANCELLED: 'Despesas canceladas não podem ser alteradas ou receber baixas.',
  EXPENSE_HAS_CONFIRMED_PAYMENTS: 'Despesas com baixas confirmadas não podem ser alteradas ou canceladas.',
  EXPENSE_AMOUNT_BELOW_PAYMENTS: 'O valor da despesa não pode ser menor que suas baixas existentes.',
  EXPENSE_PAYMENT_DATE_REQUIRED: 'Baixas confirmadas precisam informar a data do pagamento.',
  EXPENSE_PAYMENT_ALREADY_CANCELLED: 'A baixa da despesa já foi revertida.',
  COMMERCIAL_ACCESS_BLOCKED: 'O acesso comercial está bloqueado até a liquidação da primeira cobrança.',
  ORGANIZATION_OPERATIONAL_BLOCKED: 'A operação desta oficina está suspensa administrativamente.',
  INSUFFICIENT_STOCK: 'Não há estoque suficiente para concluir a ordem de serviço.',
  ORGANIZATION_INVALID_TRANSITION: 'A transição operacional solicitada para a oficina não é permitida.',
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
      type: this.problemType(customProblem.code, status),
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
      if (typeof code === 'string' && code === 'INSUFFICIENT_STOCK') {
        const detail = (exceptionResponse as Record<string, unknown>).detail;
        if (typeof detail === 'string') return detail;
      }
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

  private problemType(code: unknown, status: number): string {
    if (code === 'COMMERCIAL_ACCESS_BLOCKED') return 'https://api.autohub.local/problems/commercial-access-blocked';
    if (code === 'ORGANIZATION_OPERATIONAL_BLOCKED') return 'https://api.autohub.local/problems/organization-operational-blocked';
    return `https://api.autohub.local/problems/${status}`;
  }
}
