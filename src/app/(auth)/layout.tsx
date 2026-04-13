export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grain min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(160deg, hsl(160 84% 8%) 0%, hsl(162 75% 12%) 45%, hsl(200 70% 10%) 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsl(160 84% 27% / 0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-5%',
            left: '-5%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsl(200 70% 20% / 0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}
