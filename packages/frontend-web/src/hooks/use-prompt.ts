'use client';

import { useState } from 'react';
import { PromptRequest, PromptResponse, GeneratedApp } from '@/types';

export function usePromptSubmission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PromptResponse | null>(null);

  const submitPrompt = async (prompt: string): Promise<PromptResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const promptRequest: PromptRequest = {
        id: generateId(),
        prompt,
        context: {
          userId: 'demo-user',
          sessionId: generateId()
        }
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResponse: PromptResponse = {
        id: promptRequest.id,
        status: 'completed',
        planId: generateId(),
        appId: generateId(),
        message: 'Application generated successfully'
      };

      setResponse(mockResponse);
      return mockResponse;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    submitPrompt,
    loading,
    error,
    response
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Mock CSV Viewer App Generator
export function generateMockCSVViewer(): GeneratedApp {
  return {
    id: generateId(),
    files: [
      {
        path: 'src/app/page.tsx',
        content: `'use client';

import { useState, useCallback, useMemo } from 'react';
import { Upload, Download, Filter, Search, X } from 'lucide-react';

interface CSVRow {
  [key: string]: string | number;
}

export default function CSVViewer() {
  const [data, setData] = useState<CSVRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // Simple CSV parsing for demo
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',');
          const row: CSVRow = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          return row;
        });

        setColumns(headers);
        setData(rows);
        setFilters({});
      }
    };
    reader.readAsText(file);
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (searchTerm) {
        const searchMatch = Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!searchMatch) return false;
      }

      for (const [column, filterValue] of Object.entries(filters)) {
        if (filterValue && String(row[column]).toLowerCase() !== filterValue.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [data, searchTerm, filters]);

  const exportToCSV = useCallback(() => {
    if (filteredData.length === 0) return;

    const headers = columns.join(',');
    const rows = filteredData.map(row => 
      columns.map(col => row[col]).join(',')
    );
    const csv = [headers, ...rows].join('\\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', \`filtered-\${fileName || 'data.csv'}\`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredData, columns, fileName]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">CSV Viewer</h1>
        <p className="text-gray-600">Upload, filter, and export your CSV data</p>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="flex-1 p-2 border rounded"
          />
          {data.length > 0 && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </div>

        {data.length > 0 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search across all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 p-2 w-full border rounded"
              />
            </div>

            <div className="text-sm text-gray-600">
              Showing {filteredData.length} of {data.length} rows
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map(column => (
                      <th key={column} className="border p-2 text-left font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 100).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {columns.map(column => (
                        <td key={column} className="border p-2">
                          {String(row[column] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length > 100 && (
                <div className="text-center py-4 text-sm text-gray-600">
                  Showing first 100 rows of {filteredData.length} total rows
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`,
        language: 'typescript'
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'csv-viewer-app',
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start'
          },
          dependencies: {
            'next': '15.0.0',
            'react': '^18.0.0',
            'react-dom': '^18.0.0',
            'typescript': '^5.0.0',
            'tailwindcss': '^3.0.0',
            'lucide-react': '^0.263.0'
          }
        }, null, 2),
        language: 'json'
      }
    ],
    dependencies: {
      'next': '15.0.0',
      'react': '^18.0.0',
      'react-dom': '^18.0.0',
      'typescript': '^5.0.0',
      'tailwindcss': '^3.0.0',
      'lucide-react': '^0.263.0'
    },
    metadata: {
      framework: 'Next.js',
      language: 'TypeScript',
      entryPoint: 'src/app/page.tsx'
    }
  };
}