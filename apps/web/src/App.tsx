import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  success: boolean;
  message: string;
  timestamp: string;
};


function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const checkApi = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/health`
      );

      const data = await response.json();

      setHealth(data);
    } catch (error) {
      console.error("API connection failed:", error);
    }
  };


  useEffect(() => {
    checkApi();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">
          API Platform
        </h1>

        <p className="mt-4 text-slate-400">
          Business API Management Platform
        </p>

        <div className="mt-8 rounded-lg bg-slate-900 p-6">
          {health ? (
            <>
              <p className="text-green-400">
                ● Backend Connected
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {health.message}
              </p>
            </>
          ) : (
            <p className="text-yellow-400">
              Connecting to backend...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;