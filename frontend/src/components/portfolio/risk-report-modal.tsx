'use client';

import { useRef, useCallback } from 'react';
import { X, Download, FileText, Loader2, Clock, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface ReportSummary {
  totalAum: number;
  positionCount: number;
  riskStatus: string;
  riskScoreValue: number;
}

export interface RiskReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportContent: string;
  generatedAt: string;
  summary: ReportSummary | null;
  isLoading: boolean;
}

// Parse markdown into structured elements for rendering
function parseMarkdownToElements(content: string) {
  const lines = content.split('\n');
  const elements: Array<{
    type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'table-header' | 'table-row' | 'table-separator' | 'empty';
    content: string;
    cells?: string[];
  }> = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed === '') {
      elements.push({ type: 'empty', content: '' });
    } else if (trimmed.startsWith('### ')) {
      elements.push({ type: 'h3', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      elements.push({ type: 'h2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      elements.push({ type: 'h1', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      // Check if this is a separator row (---|---|---)
      const isSeparator = cells.every(c => /^[-:]+$/.test(c));
      if (isSeparator) {
        elements.push({ type: 'table-separator', content: trimmed, cells });
      } else {
        // Check if previous non-separator element was a table to determine header vs row
        const lastTable = [...elements].reverse().find(e =>
          e.type === 'table-header' || e.type === 'table-row' || e.type === 'table-separator'
        );
        if (!lastTable) {
          elements.push({ type: 'table-header', content: trimmed, cells });
        } else {
          elements.push({ type: 'table-row', content: trimmed, cells });
        }
      }
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push({ type: 'bullet', content: trimmed.slice(2) });
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push({ type: 'bullet', content: trimmed });
    } else {
      elements.push({ type: 'paragraph', content: trimmed });
    }
  }

  return elements;
}

// Format inline markdown (bold, italic)
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function RiskReportModal({
  isOpen,
  onClose,
  reportContent,
  generatedAt,
  summary,
  isLoading,
}: RiskReportModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (!reportContent) return;

    // Dynamic import of jsPDF for client-side PDF generation
    const jsPDFModule = await import('jspdf') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const JsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 25;
    const marginRight = 25;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const marginTop = 30;
    const marginBottom = 25;
    let y = marginTop;

    const addPageIfNeeded = (spaceNeeded: number) => {
      if (y + spaceNeeded > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
        // Add page header line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, marginTop - 5, pageWidth - marginRight, marginTop - 5);
      }
    };

    // Title page header
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('INTERCONECTION TREASURY MGMT', marginLeft, 15);
    doc.text(`Gerado em: ${new Date(generatedAt).toLocaleString('pt-BR')}`, pageWidth - marginRight, 15, { align: 'right' });

    // Separator line
    doc.setDrawColor(168, 85, 247); // purple
    doc.setLineWidth(0.8);
    doc.line(marginLeft, 20, pageWidth - marginRight, 20);

    y = 30;

    const elements = parseMarkdownToElements(reportContent);

    for (const el of elements) {
      const plainText = el.content
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1');

      switch (el.type) {
        case 'h1': {
          addPageIfNeeded(18);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          const h1Lines = doc.splitTextToSize(plainText, contentWidth);
          doc.text(h1Lines, pageWidth / 2, y, { align: 'center' });
          y += h1Lines.length * 7 + 4;
          // Underline
          doc.setDrawColor(168, 85, 247);
          doc.setLineWidth(0.5);
          doc.line(marginLeft + 20, y, pageWidth - marginRight - 20, y);
          y += 8;
          break;
        }
        case 'h2': {
          addPageIfNeeded(14);
          y += 4;
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);
          const h2Lines = doc.splitTextToSize(plainText, contentWidth);
          doc.text(h2Lines, marginLeft, y);
          y += h2Lines.length * 5.5 + 2;
          // Small underline
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(marginLeft, y, marginLeft + 50, y);
          y += 4;
          break;
        }
        case 'h3': {
          addPageIfNeeded(12);
          y += 2;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          const h3Lines = doc.splitTextToSize(plainText, contentWidth);
          doc.text(h3Lines, marginLeft, y);
          y += h3Lines.length * 4.5 + 3;
          break;
        }
        case 'bullet': {
          addPageIfNeeded(8);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          const bulletLines = doc.splitTextToSize(plainText, contentWidth - 8);
          // Bullet point
          doc.setFillColor(168, 85, 247);
          doc.circle(marginLeft + 2, y - 1, 0.8, 'F');
          doc.text(bulletLines, marginLeft + 6, y);
          y += bulletLines.length * 4 + 2;
          break;
        }
        case 'table-header': {
          if (!el.cells) break;
          addPageIfNeeded(10);
          const colWidth = contentWidth / el.cells.length;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          // Header background
          doc.setFillColor(80, 80, 100);
          doc.rect(marginLeft, y - 4, contentWidth, 6, 'F');
          el.cells.forEach((cell, i) => {
            const cellText = doc.splitTextToSize(cell, colWidth - 4);
            doc.text(cellText[0] || '', marginLeft + i * colWidth + 2, y);
          });
          y += 5;
          break;
        }
        case 'table-row': {
          if (!el.cells) break;
          addPageIfNeeded(8);
          const colW = contentWidth / el.cells.length;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          // Alternate row background
          doc.setFillColor(245, 245, 250);
          doc.rect(marginLeft, y - 3.5, contentWidth, 5, 'F');
          el.cells.forEach((cell, i) => {
            const cellText = doc.splitTextToSize(cell, colW - 4);
            doc.text(cellText[0] || '', marginLeft + i * colW + 2, y);
          });
          y += 5;
          break;
        }
        case 'table-separator':
          // Skip separator
          break;
        case 'paragraph': {
          addPageIfNeeded(8);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          const pLines = doc.splitTextToSize(plainText, contentWidth);
          doc.text(pLines, marginLeft, y);
          y += pLines.length * 4 + 2;
          break;
        }
        case 'empty':
          y += 2;
          break;
      }
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text(
        `Interconection Treasury MGMT - Confidencial`,
        marginLeft,
        pageHeight - 10
      );
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth - marginRight,
        pageHeight - 10,
        { align: 'right' }
      );
    }

    doc.save(`portfolio-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [reportContent, generatedAt]);

  if (!isOpen) return null;

  const elements = reportContent ? parseMarkdownToElements(reportContent) : [];

  // Group table rows together for rendering
  const renderElements = () => {
    const result: JSX.Element[] = [];
    let tableRows: Array<{ type: string; cells?: string[] }> = [];
    let inTable = false;

    const flushTable = () => {
      if (tableRows.length === 0) return;
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1).filter(r => r.type !== 'table-separator');

      result.push(
        <div key={`table-${result.length}`} className="my-4 overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="w-full text-[11px]">
            {headerRow.cells && (
              <thead>
                <tr className={isDark ? 'bg-white/[0.04]' : 'bg-gray-50'}>
                  {headerRow.cells.map((cell, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-3 py-2 text-left font-semibold border-b',
                        isDark ? 'text-white/80 border-white/[0.08]' : 'text-gray-700 border-gray-200'
                      )}
                      dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                    />
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {dataRows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    ri % 2 === 0
                      ? (isDark ? 'bg-white/[0.02]' : 'bg-white')
                      : (isDark ? 'bg-white/[0.04]' : 'bg-gray-50/50')
                  )}
                >
                  {row.cells?.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        'px-3 py-2 border-b',
                        isDark ? 'text-white/60 border-white/[0.04]' : 'text-gray-600 border-gray-100'
                      )}
                      dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      if (el.type === 'table-header' || el.type === 'table-row' || el.type === 'table-separator') {
        inTable = true;
        tableRows.push(el);
        continue;
      }

      if (inTable) {
        flushTable();
      }

      switch (el.type) {
        case 'h1':
          result.push(
            <h1
              key={i}
              className={cn(
                'text-center text-[18px] font-bold tracking-wide pb-3 mb-6 border-b-2',
                isDark
                  ? 'text-white border-accent-purple/40'
                  : 'text-gray-900 border-purple-300'
              )}
              dangerouslySetInnerHTML={{ __html: formatInline(el.content) }}
            />
          );
          break;
        case 'h2':
          result.push(
            <h2
              key={i}
              className={cn(
                'text-[14px] font-bold mt-6 mb-3 pb-1.5 border-b',
                isDark
                  ? 'text-white/90 border-white/[0.06]'
                  : 'text-gray-800 border-gray-200'
              )}
              dangerouslySetInnerHTML={{ __html: formatInline(el.content) }}
            />
          );
          break;
        case 'h3':
          result.push(
            <h3
              key={i}
              className={cn(
                'text-[12px] font-semibold mt-4 mb-2',
                isDark ? 'text-white/80' : 'text-gray-700'
              )}
              dangerouslySetInnerHTML={{ __html: formatInline(el.content) }}
            />
          );
          break;
        case 'bullet':
          result.push(
            <div key={i} className="flex items-start gap-2 ml-2 mb-1.5">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                isDark ? 'bg-accent-purple/60' : 'bg-purple-400'
              )} />
              <p
                className={cn('text-[11px] leading-relaxed', isDark ? 'text-white/60' : 'text-gray-600')}
                dangerouslySetInnerHTML={{ __html: formatInline(el.content) }}
              />
            </div>
          );
          break;
        case 'paragraph':
          result.push(
            <p
              key={i}
              className={cn(
                'text-[11px] leading-relaxed mb-2 text-justify',
                isDark ? 'text-white/60' : 'text-gray-600'
              )}
              dangerouslySetInnerHTML={{ __html: formatInline(el.content) }}
            />
          );
          break;
        case 'empty':
          result.push(<div key={i} className="h-1" />);
          break;
      }
    }

    if (inTable) flushTable();
    return result;
  };

  const statusColors: Record<string, string> = {
    healthy: 'text-status-success',
    warning: 'text-accent-yellow',
    danger: 'text-status-error',
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 backdrop-blur-sm',
          isDark ? 'bg-black/70' : 'bg-black/40'
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={cn(
              'relative w-full max-w-3xl max-h-[90vh] flex flex-col backdrop-blur-xl rounded-2xl shadow-xl',
              'animate-in fade-in-0 zoom-in-95',
              isDark
                ? 'bg-[rgba(18,18,28,0.98)] border border-[rgba(255,255,255,0.08)]'
                : 'bg-white border border-gray-200 shadow-2xl'
            )}
          >
            {/* Header */}
            <div className={cn(
              'flex items-center justify-between px-6 py-4 border-b shrink-0',
              isDark ? 'border-white/[0.06]' : 'border-gray-200'
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center',
                  isDark ? 'bg-accent-purple/10' : 'bg-purple-50'
                )}>
                  <FileText className={cn('w-5 h-5', isDark ? 'text-accent-purple' : 'text-purple-500')} />
                </div>
                <div>
                  <h2 className={cn(
                    'text-[14px] font-semibold',
                    isDark ? 'text-white' : 'text-gray-900'
                  )}>
                    Relatório de Análise de Portfólio
                  </h2>
                  {generatedAt && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className={cn('w-3 h-3', isDark ? 'text-white/30' : 'text-gray-400')} />
                      <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-400')}>
                        {new Date(generatedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {reportContent && !isLoading && (
                  <button
                    onClick={handleDownloadPdf}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all',
                      isDark
                        ? 'bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 border border-accent-purple/20'
                        : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                    )}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar PDF
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    isDark
                      ? 'text-white/50 hover:text-white hover:bg-white/10'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Summary Bar */}
            {summary && !isLoading && (
              <div className={cn(
                'flex items-center gap-6 px-6 py-3 border-b shrink-0',
                isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-gray-50/50 border-gray-100'
              )}>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[10px]', isDark ? 'text-white/40' : 'text-gray-500')}>AUM</span>
                  <span className={cn('text-[11px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    ${summary.totalAum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[10px]', isDark ? 'text-white/40' : 'text-gray-500')}>Posições</span>
                  <span className={cn('text-[11px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {summary.positionCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className={cn('w-3 h-3', statusColors[summary.riskStatus] || 'text-white/40')} />
                  <span className={cn('text-[10px]', isDark ? 'text-white/40' : 'text-gray-500')}>Risk Score</span>
                  <span className={cn(
                    'text-[11px] font-semibold tabular-nums',
                    statusColors[summary.riskStatus] || (isDark ? 'text-white' : 'text-gray-900')
                  )}>
                    {summary.riskScoreValue}/100
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div
              ref={reportRef}
              className={cn(
                'flex-1 overflow-y-auto px-8 py-6',
                isDark ? 'custom-scrollbar-dark' : 'custom-scrollbar-light'
              )}
              style={{ maxHeight: 'calc(90vh - 160px)' }}
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                    isDark ? 'bg-accent-purple/10' : 'bg-purple-50'
                  )}>
                    <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-accent-purple' : 'text-purple-500')} />
                  </div>
                  <p className={cn('text-[12px] font-medium', isDark ? 'text-white/70' : 'text-gray-700')}>
                    Gerando análise do portfólio...
                  </p>
                  <p className={cn('text-[10px] mt-1', isDark ? 'text-white/30' : 'text-gray-400')}>
                    A IA está analisando suas posições e métricas de risco
                  </p>
                  <div className="mt-6 flex items-center gap-4">
                    {['Coletando dados', 'Analisando risco', 'Gerando relatório'].map((step, i) => (
                      <div key={step} className="flex items-center gap-1.5">
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full animate-pulse',
                          isDark ? 'bg-accent-purple/40' : 'bg-purple-300'
                        )} style={{ animationDelay: `${i * 0.5}s` }} />
                        <span className={cn('text-[9px]', isDark ? 'text-white/25' : 'text-gray-400')}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : reportContent ? (
                <div className="report-content">
                  {renderElements()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <AlertTriangle className={cn('w-8 h-8 mb-3', isDark ? 'text-white/10' : 'text-gray-200')} />
                  <p className={cn('text-[11px]', isDark ? 'text-white/30' : 'text-gray-400')}>
                    Nenhum relatório disponível
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
