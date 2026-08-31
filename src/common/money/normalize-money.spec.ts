import { plainToInstance } from 'class-transformer';
import { CreatePaymentDto } from '../../payments/dto/create-payment.dto';
import { CreateProductDto } from '../../products/dto/create-product.dto';
import { CreateServiceDto } from '../../service-catalog/dto/create-service.dto';
import { CreateQuoteItemDto } from '../../quotes/dto/create-quote-item.dto';
import { CreateWorkOrderItemDto } from '../../work-orders/dto/create-work-order-item.dto';

describe('money input normalization', () => {
  it('converts Brazilian decimal separators to API-safe decimal strings', () => {
    expect(plainToInstance(CreateProductDto, { name: 'Filtro', salePrice: '5,50' }).salePrice).toBe('5.50');
    expect(plainToInstance(CreateServiceDto, { name: 'Revisão', price: '5,50' }).price).toBe('5.50');
    expect(plainToInstance(CreatePaymentDto, { amount: '5,50' }).amount).toBe('5.50');
    expect(plainToInstance(CreateQuoteItemDto, { quantity: '1', unitPrice: '5,50' }).unitPrice).toBe('5.50');
    expect(plainToInstance(CreateWorkOrderItemDto, { quantity: '1', unitPrice: '5,50' }).unitPrice).toBe('5.50');
  });

  it('removes Brazilian thousands separators before validation', () => {
    expect(plainToInstance(CreateProductDto, { name: 'Filtro', salePrice: '1.234,56' }).salePrice).toBe('1234.56');
  });
});
