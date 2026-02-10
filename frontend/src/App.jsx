import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, Camera } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: MAX_FILE_SIZE,
    onDrop: (accepted, rejected) => {
      if (rejected.length) { setError('Invalid file'); return; }
      const f = accepted[0]; setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null);
    },
  });

  const handleAnalyze = async () => {
    setLoading(true); setError(null);
    try { await new Promise(r => setTimeout(r, 2000)); setResult({ breed: 'Gir', confidence: 0.94 });
    } catch { setError('Analysis failed.'); } finally { setLoading(false); }
  };

  const handleReset = () => { setFile(null); setPreview(null); setResult(null); setError(null); };

  return (<main className='min-h-screen bg-gradient-to-b from-amber-50 to-white'>
    <header className='border-b border-stone-200 bg-white/80 backdrop-blur'><div className='max-w-4xl mx-auto px-4 py-4 flex items-center gap-3'><Camera className='h-6 w-6 text-amber-600' /><h1 className='text-xl font-bold'>Cattleman</h1><span className='text-xs text-stone-400 ml-auto'>Breed Recognition</span></div></header>
    <div className='max-w-xl mx-auto px-4 py-8 space-y-6'>
      {!file ? (
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragActive?'border-amber-500 bg-amber-100/60':'border-stone-300 hover:border-amber-400 bg-white'}`}>
          <input {...getInputProps()} /><Upload className='mx-auto h-12 w-12 text-stone-300 mb-4' />
          <p className='text-stone-500'>{isDragActive?'Drop here …':'Drag & drop a cattle or buffalo photo'}</p>
          <p className='text-xs text-stone-400 mt-2'>PNG, JPG, WebP — max 5 MB</p></div>
      ) : (<><div className='relative rounded-xl overflow-hidden border shadow-sm bg-white'>
        <img src={preview} alt='Preview' className='w-full h-72 object-cover' />
        <button onClick={handleReset} className='absolute top-3 right-3 rounded-full bg-black/50 p-1.5 text-white'><X className='h-4 w-4' /></button></div>
        <Button onClick={handleAnalyze} disabled={loading} className='w-full'>{loading?<><Loader2 className='mr-2 h-4 w-4 animate-spin'/>Analyzing…</>:'Analyze Breed'}</Button>
        {result && (<Card className='p-6'><div className='flex items-center justify-between mb-3'><h3 className='text-lg font-semibold'>{result.breed}</h3><Badge className='bg-amber-100'>{Math.round(result.confidence*100)}% match</Badge></div><Progress value={result.confidence*100} className='mb-4'/><p className='text-sm text-stone-500'>Origin: Gujarat | Type: Cattle (Dairy)</p></Card>)}
        {error && <div className='rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700'>{error}</div>}</>)
      }</div></main>);
}
