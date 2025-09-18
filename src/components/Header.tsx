// src/components/Header.tsx
const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <a href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-sm" />
          <div className="leading-tight">
            <h1 className="text-xl font-extrabold tracking-tight text-gray-800">
              Make the Image
            </h1>
            <p className="hidden text-xs text-gray-500 sm:block -mt-0.5">
              JLstudios Creation · Powered by you
            </p>
          </div>
        </a>

        {/* Right-side actions */}
        <nav className="flex items-center gap-2">
          {/* How to play / About */}
          <a
            href="/about.html"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 active:scale-95"
          >
            How to play
          </a>
          {/* (Optional) future nav items can go here */}
        </nav>
      </div>
    </header>
  );
};

export default Header;
