import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: MAX_FILE_SIZE,
    onDrop: (accepted) => {
      const f = accepted[0]; if (!f) return;
      setFile(f); setPreview(URL.createObjectURL(f)); setResult(null);
    },
  });

  const handleReset = () => { setFile(null); setPreview(null); setResult(null); };

  return (
    <main className='min-h-screen bg-amber-50'>
      <div className='max-w-xl mx-auto px-4 py-12'>
        <h1 className='text-3xl font-bold text-center text-stone-800 mb-2'>Cattleman</h1>
        <p className='text-center text-stone-500 mb-8'>Upload a photo of Indian cattle or buffalo to identify the breed.</p>
        {!file ? (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive?'border-amber-500 bg-amber-100/50':'border-stone-300 hover:border-amber-400'}`}>
            <input {...getInputProps()} />
            <Upload className='mx-auto h-10 w-10 text-stone-400 mb-3' />
            <p className='text-stone-500'>{isDragActive?'Drop image here …':'Drag & drop an image, or click to browse'}</p>
            <p className='text-xs text-stone-400 mt-2'>PNG, JPG, or WebP up to 5 MB</p>
          </div>) : (
          <div className='space-y-6'>
            <div className='relative rounded-xl overflow-hidden border border-stone-200 bg-white'>
              <img src={preview} alt='Preview' className='w-full h-64 object-cover' />
              <button onClick={handleReset} className='absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white'><X className='h-4 w-4' /></button>
            </div>
          </div>
        )}
      </div></main>);
}
