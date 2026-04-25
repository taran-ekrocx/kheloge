export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold text-blue-700">Kheloge</h1>
      <p className="mt-4 text-xl text-gray-600">Sports Management Platform</p>
      <a href="/login" className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
        Sign In
      </a>
    </main>
  );
}
