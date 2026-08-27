import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SecurityLogger } from './security.logger';

const SAFE_MESSAGES = new Set([
  'Request validation failed.',
  'Authentication required',
  'Invalid credentials',
  'Activation token is invalid or expired',
  'Account cannot be activated',
  'Platform access requires Super Admin',
  'Organization Admin access required',
  'Organization not found',
  'Organization or admin already exists',
  'Organization document already exists',
  'User email already exists',
  'User not found',
  'Customer not found',
  'Customer or Vehicle not found',
  'Customer document already exists in this Organization',
  'Vehicle not found',
  'Vehicle plate already exists in this Organization',
  'Service not found',
  'Active Service not found',
  'Product not found',
  'Active Product not found',
  'Product SKU already exists in this Organization',
  'Quote not found',
  'Quote Item not found',
  'Quote number already exists in this Organization',
  'Only draft Quotes can be edited',
  'SERVICE requires only serviceId',
  'PRODUCT requires only productId',
  'MANUAL requires description and unitPrice',
  'Work Order not found',
  'Work Order Item not found',
  'Historical Work Orders cannot be edited',
  'Payment not found',
  'Payment is already cancelled.',
]);

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
  QUOTE_INVALID_TRANSITION: 'The requested Quote transition is not allowed.',
  QUOTE_NOT_APPROVED: 'Only approved Quotes can be converted into Work Orders.',
  QUOTE_ALREADY_CONVERTED: 'This Quote has already been converted into a Work Order.',
  WORK_ORDER_INVALID_TRANSITION: 'The requested Work Order transition is not allowed.',
  WORK_ORDER_CANCELLED: 'Cancelled Work Orders cannot receive Payments.',
  PAYMENT_EXCEEDS_BALANCE: 'Payment exceeds the Work Order balance.',
  PAYMENT_ALREADY_CANCELLED: 'Payment is already cancelled.',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly securityLogger = new SecurityLogger()) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException && status < 500
      ? this.safeDetail(exception)
      : 'An unexpected error occurred.';

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
      title: HttpStatus[status] ?? 'Error',
      status,
      detail,
      instance: request.url,
      code: this.safeCode(customProblem.code, status),
    });
  }

  private safeDetail(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();
    if (exception.getStatus() === HttpStatus.BAD_REQUEST && typeof exceptionResponse !== 'string') {
      return 'Request validation failed.';
    }
    if (typeof exceptionResponse === 'string' && SAFE_MESSAGES.has(exceptionResponse)) return exceptionResponse;
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const code = (exceptionResponse as Record<string, unknown>).code;
      if (typeof code === 'string' && SAFE_CODES.has(code)) return SAFE_CODE_DETAILS[code];
    }
    return 'The request could not be completed.';
  }

  private safeCode(code: unknown, status: number): string {
    return typeof code === 'string' && SAFE_CODES.has(code) ? code : `HTTP_${status}`;
  }
}
