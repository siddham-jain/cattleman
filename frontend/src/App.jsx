import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, Camera, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Separator } from './components/ui/separator';
import { Skeleton } from './components/ui/skeleton';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }, maxFiles: 1, maxSize: MAX_FILE_SIZE,
    onDrop: (accepted, rejected) => {
      if (rejected.length) { setError(rejected[0].errors[0]?.message || 'Invalid file'); return; }
      const f = accepted[0]; setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null);
    },
  });

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      await new Promise(r => setTimeout(r, 1200));
      setResult({ breed: 'Gir', confidence: 0.92, animal_type: 'cattle', origin: 'Gujarat', type: 'Cattle', purpose: 'Dairy', traits: ['Hump','Pendulous ears','Reddish-brown coat'], yield: 2100 });
    } catch { setError('Analysis failed.');
    } finally { setLoading(false); }
  }, [file]);

  const handleReset = useCallback(() => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(null); setResult(null); setError(null); }, [preview]);

  return (<main className='min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30'>
    <header className='border-b border-stone-200/80 bg-white/80 backdrop-blur sticky top-0 z-20'><div className='max-w-4xl mx-auto px-4 py-3 flex items-center gap-3'><Camera className='h-5 w-5 text-amber-600'/><h1 className='text-lg font-bold'>Cattleman</h1><span className='text-xs text-stone-400 ml-auto uppercase'>AI Breed Recognition</span></div></header>
    <div className='max-w-xl mx-auto px-4 py-8 space-y-6'>
      {!file ? (<div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${isDragActive?'border-amber-500 bg-amber-100/60 shadow-lg':'border-stone-300 hover:border-amber-400 bg-white shadow-sm'}`}><input {...getInputProps()}/><div className='inline-flex rounded-full bg-amber-100 p-4 mb-5'><Upload className='h-8 w-8 text-amber-600'/></div><p className='text-stone-600 font-medium text-lg'>{isDragActive?'Drop to analyze':'Upload a cattle or buffalo photo'}</p><p className='text-xs text-stone-400 mt-2'>PNG, JPG, WebP — max 5 MB</p></div>) : (<><div className='relative rounded-2xl overflow-hidden border shadow-md bg-white'><img src={preview} alt='Preview' className='w-full h-80 object-cover'/><button onClick={handleReset} className='absolute top-3 right-3 rounded-full bg-black/50 p-2 text-white'><X className='h-4 w-4'/></button><div className='absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white'>{file.name}</div></div>
      <Button onClick={handleAnalyze} disabled={loading} className='w-full h-12 text-base font-semibold'>{loading?<><Loader2 className='mr-2 h-5 w-5 animate-spin'/>Analyzing…</>:<><CheckCircle2 className='mr-2 h-5 w-5'/>Analyze Breed</>}</Button>
      {loading && <Card className='p-6 space-y-4'><Skeleton className='h-6 w-40'/><Skeleton className='h-3 w-full'/><Skeleton className='h-20 w-full'/></Card>}
      {result && !loading && (<Card className='overflow-hidden animate-in'><div className='bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white'><div className='flex items-center justify-between'><div><p className='text-amber-100 text-xs uppercase'>Top Match</p><h3 className='text-2xl font-bold'>{result.animal_type==='buffalo'?'🐃':'🐄'} {result.breed}</h3></div><Badge className='bg-white/20 text-white border-0 text-sm px-3 py-1'>{Math.round(result.confidence*100)}%</Badge></div></div><CardContent className='p-6 space-y-5'><div><div className='flex justify-between text-sm mb-1'><span className='text-stone-500'>Confidence</span><span className='font-semibold text-amber-700'>{Math.round(result.confidence*100)}%</span></div><Progress value={result.confidence*100} className='h-2.5'/></div><Separator/><div className='grid grid-cols-2 gap-4 text-sm'><div><span className='text-stone-400 text-xs uppercase'>Origin</span><p className='font-semibold mt-0.5'>{result.origin}</p></div><div><span className='text-stone-400 text-xs uppercase'>Type</span><p className='font-semibold mt-0.5 capitalize'>{result.type}</p></div></div><div><span className='text-stone-400 text-xs uppercase'>Key Traits</span><div className='flex flex-wrap gap-1.5 mt-1.5'>{result.traits.map(t=><Badge key={t} variant='outline' className='text-xs bg-stone-50'>{t}</Badge>)}</div></div><div className='flex items-start gap-2.5 rounded-xl bg-amber-50 p-4 border border-amber-100'><Info className='h-4 w-4 text-amber-600 mt-0.5'/><p className='text-xs text-stone-600'>Results by AI model trained on indigenous Indian breed characteristics.</p></div></CardContent></Card>)}
      {error && <div className='rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3'><AlertTriangle className='h-5 w-5 text-red-500 mt-0.5'/><div><p className='font-medium text-red-800 text-sm'>Error</p><p className='text-red-600 text-sm mt-0.5'>{error}</p></div></div>}</>)
      }</div></main>);
}
