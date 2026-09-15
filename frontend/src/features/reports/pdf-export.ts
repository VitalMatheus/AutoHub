import type { ManagerialReport } from './api/reports-api';

const categoryLabels: Record<string, string> = { PARTS: 'Peças e insumos', LABOR: 'Pessoal', RENT: 'Aluguel', UTILITIES: 'Utilidades', TAXES: 'Impostos', FINANCIAL_FEES: 'Taxas financeiras', MAINTENANCE: 'Manutenção', MARKETING: 'Marketing', OTHER: 'Outros' };
const latin1: Record<string, number> = { á: 0xe1, ã: 0xe3, ç: 0xe7, é: 0xe9, ê: 0xea, í: 0xed, ó: 0xf3, ô: 0xf4, õ: 0xf5, ú: 0xfa, à: 0xe0, â: 0xe2, Á: 0xc1, Ã: 0xc3, Ç: 0xc7, É: 0xc9, Ê: 0xca, Í: 0xcd, Ó: 0xd3, Ô: 0xd4, Õ: 0xd5, Ú: 0xda, À: 0xc0, Â: 0xc2 };
const pdfText = (value: string) => [...value].map((character) => { const byte = latin1[character] ?? character.charCodeAt(0); if (byte > 127) return `\\${byte.toString(8).padStart(3, '0')}`; if ('\\()'.includes(character)) return `\\${character}`; return character; }).join('');
const money = (value: string) => `R$ ${value.replace('.', ',')}`;
const date = (value: string) => value.split('-').reverse().join('/');
const sumMoney = (values: string[]) => { const cents = values.reduce((total, value) => total + BigInt(value.replace('.', '').replace(',', '')), 0n); return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`; };

type Row = { label: string; value?: string; kind: 'body' | 'section' | 'metric' };
const body = (label: string, value?: string): Row => ({ label, value, kind: 'body' });
const section = (label: string): Row => ({ label, kind: 'section' });
const metric = (label: string, value: string): Row => ({ label, value, kind: 'metric' });

function rowsFor(report: ManagerialReport): Row[] {
  return [section('RESUMO FINANCEIRO'), metric('Receita realizada', money(report.revenue.total)), metric('Despesas pagas', money(report.realizedExpenses.total)), metric('Resultado de caixa', money(report.cashResult)), metric('Lucro operacional', money(report.operatingProfit)), section('DRE GERENCIAL SIMPLIFICADA'), body('Receitas de ordens de serviço', money(report.revenue.workOrders)), body('Receitas de vendas', money(report.revenue.directSales)), body('Lucro bruto', money(report.grossProfit)), body('Margem bruta de peças', report.partsGrossMargin.margin ? money(report.partsGrossMargin.margin) : 'Não rastreável'), section('DESPESAS PAGAS POR CATEGORIA'), ...(report.realizedExpenses.byCategory.length ? report.realizedExpenses.byCategory.map((item) => body(categoryLabels[item.category] ?? item.category, money(item.amount))) : [body('Nenhuma despesa paga no período.')]), section('CONTAS EM ABERTO'), body('A receber', money(sumMoney(report.accountsReceivable.map((item) => item.balance)))), body('A pagar', money(sumMoney(report.accountsPayable.map((item) => item.balance)))), section('COMPARATIVO MENSAL'), ...(report.monthlyComparison.length ? report.monthlyComparison.map((item) => body(item.month, `Receitas ${money(item.revenue)}   Despesas ${money(item.expenses)}   Caixa ${money(item.cashResult)}`)) : [body('Nenhum movimento no período.')]), body('Documento gerado pela Vekar. Visão gerencial em regime de caixa; não substitui apuração contábil ou fiscal.')];
}

function textCommand(text: string, x: number, y: number, size: number, font: string, color: string) { return `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`; }
function pageContent(rows: Row[], organizationName: string, report: ManagerialReport, page: number, pageCount: number) {
  const commands = ['0.08 0.35 0.62 rg 0 742 595 100 re f', '0.08 0.35 0.62 rg 0 0 595 26 re f', textCommand(organizationName, 42, 800, 19, 'F2', '1 1 1'), textCommand('RELATÓRIO GERENCIAL', 42, 777, 10, 'F2', '0.84 0.91 1'), textCommand(`Período: ${date(report.from)} a ${date(report.to)}`, 42, 759, 9, 'F1', '0.84 0.91 1'), textCommand(`Vekar  |  Página ${page} de ${pageCount}`, 42, 10, 8, 'F1', '1 1 1')];
  let y = 715;
  rows.forEach((row) => { if (row.kind === 'section') { y -= 8; commands.push(`0.91 0.95 0.98 rg 38 ${y - 5} 519 21 re f`, textCommand(row.label, 48, y + 1, 9, 'F2', '0.08 0.35 0.62')); y -= 27; } else { const size = row.kind === 'metric' ? 10 : 9; commands.push(textCommand(row.label, 52, y, size, row.kind === 'metric' ? 'F2' : 'F1', '0.12 0.18 0.27')); if (row.value) { const valueWidth = row.value.length * size * 0.5; commands.push(textCommand(row.value, Math.max(260, 543 - valueWidth), y, size, row.kind === 'metric' ? 'F2' : 'F1', '0.12 0.18 0.27')); } y -= row.kind === 'metric' ? 23 : 19; } });
  return commands.join('\n');
}

export function createManagerialReportPdf(report: ManagerialReport, organizationName: string) {
  const rows = rowsFor(report); const pages = rows.reduce<Row[][]>((result, row, index) => { const page = Math.floor(index / 26); result[page] ??= []; result[page].push(row); return result; }, []); const pageNumbers = pages.map((_, index) => 3 + index * 2); const fontObject = 3 + pages.length * 2;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`, ...pages.flatMap((page, index) => { const content = pageContent(page, organizationName, report, index + 1, pages.length); return [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObject} 0 R /F2 ${fontObject + 1} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`]; }), '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadManagerialReportPdf(report: ManagerialReport, organizationName: string) { const blob = createManagerialReportPdf(report, organizationName); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `relatorio-gerencial-${report.from}-${report.to}.pdf`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
