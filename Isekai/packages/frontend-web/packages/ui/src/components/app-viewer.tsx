'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ExternalLink, Code, Download } from 'lucide-react';
import { GeneratedApp } from '@imagine/types';

interface AppViewerProps {
  app: GeneratedApp | null;
  appUrl?: string;
}

export function AppViewer({ app, appUrl }: AppViewerProps) {
  if (!app) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No application generated yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleViewApp = () => {
    if (appUrl) {
      window.open(appUrl, '_blank');
    }
  };

  const handleDownloadCode = () => {
    const zip = new JSZip();
    
    // Add files to zip
    app.files.forEach(file => {
      zip.file(file.path, file.content);
    });

    // Generate and download zip
    zip.generateAsync({ type: 'blob' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.id}-code.zip`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Generated Application</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{app.metadata.framework}</Badge>
            <Badge variant="outline">{app.metadata.language}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">App ID:</span>
            <div className="text-gray-600">{app.id}</div>
          </div>
          <div>
            <span className="font-medium">Files:</span>
            <div className="text-gray-600">{app.files.length}</div>
          </div>
          <div>
            <span className="font-medium">Dependencies:</span>
            <div className="text-gray-600">{Object.keys(app.dependencies).length}</div>
          </div>
          <div>
            <span className="font-medium">Entry Point:</span>
            <div className="text-gray-600">{app.metadata.entryPoint}</div>
          </div>
        </div>

        <div className="flex gap-2">
          {appUrl && (
            <Button onClick={handleViewApp} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View App
            </Button>
          )}
          
          <Button variant="outline" onClick={handleDownloadCode} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Code
          </Button>
        </div>

        <div>
          <h4 className="font-medium mb-2">Dependencies</h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(app.dependencies).map(([name, version]) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}@{version}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">File Structure</h4>
          <div className="bg-gray-50 p-3 rounded text-sm font-mono max-h-48 overflow-y-auto">
            {app.files.map(file => (
              <div key={file.path} className="flex items-center gap-2">
                <Code className="h-3 w-3 text-gray-400" />
                {file.path}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}