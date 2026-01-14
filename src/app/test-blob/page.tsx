import BlobStorageDemo from '@/components/BlobStorageDemo';

export default function TestBlobPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Vercel Blob Storage Test
          </h1>
          <p className="text-gray-600">
            Test uploading and managing files in Vercel Blob storage
          </p>
        </div>
        
        <BlobStorageDemo />
        
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h3>
          <ol className="text-blue-800 space-y-1 text-sm">
            <li>1. Get a Vercel Blob token from <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Vercel Dashboard</a></li>
            <li>2. Create a <code className="bg-blue-100 px-1 rounded">.env.local</code> file with: <code className="bg-blue-100 px-1 rounded">BLOB_READ_WRITE_TOKEN=your_token</code></li>
            <li>3. Restart the development server</li>
            <li>4. Try uploading test data above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

