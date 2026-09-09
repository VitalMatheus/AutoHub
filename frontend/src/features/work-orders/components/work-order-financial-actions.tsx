import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPayment, type PaymentInput } from '@/features/finance/api/payments-api';
import { PaymentForm } from '@/features/finance/components/payment-form';

type Props = { workOrderId: string; openPrompt?: boolean; onClosePrompt?: () => void; showLink?: boolean };

export function WorkOrderFinancialActions({ workOrderId, openPrompt = false, onClosePrompt = () => undefined, showLink = true }: Props) {
  const client = useQueryClient();
  const payment = useMutation({
    mutationFn: (input: PaymentInput) => createPayment(workOrderId, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['payments', workOrderId] });
      onClosePrompt();
    },
  });
  return <>{showLink && !openPrompt && <Link to={`/app/finance/work-orders/${workOrderId}`} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">Financeiro da OS</Link>}{openPrompt && <div role="dialog" aria-modal="true" aria-labelledby="work-order-payment-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><section className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"><h2 id="work-order-payment-title" className="text-lg font-bold">Registrar pagamento da OS</h2><p className="mt-2 text-sm text-slate-600">A OS foi atualizada. Registre agora um recebimento ou deixe o saldo pendente para lançar depois no Financeiro.</p><div className="mt-4"><PaymentForm submitting={payment.isPending} onSubmit={(input) => payment.mutateAsync(input)} /></div>{payment.isError && <p role="alert" className="mt-3 text-sm text-red-600">Não foi possível registrar o pagamento.</p>}<button type="button" onClick={onClosePrompt} className="mt-3 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Fechar</button></section></div>}</>;
}
