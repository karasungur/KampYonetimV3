import { useState, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0]; // İlk dosyayı al
      
      if (file.size > maxFileSize) {
        throw new Error(`Dosya boyutu ${maxFileSize / 1024 / 1024}MB'den büyük olamaz`);
      }

      // Upload parameters al
      const uploadParams = await onGetUploadParameters();
      
      // Dosyayı upload et
      const response = await fetch(uploadParams.url, {
        method: uploadParams.method,
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Success callback
      onComplete?.({
        successful: [{
          uploadURL: uploadParams.url,
          name: file.name,
          size: file.size,
        }],
      });

    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={maxNumberOfFiles > 1}
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
      />
      
      <Button 
        onClick={handleClick} 
        className={buttonClassName}
        disabled={isUploading}
      >
        {isUploading ? 'Yükleniyor...' : children}
      </Button>
    </div>
  );
}