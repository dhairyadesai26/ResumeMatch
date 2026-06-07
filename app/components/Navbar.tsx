import {Link} from "react-router";
import {usePuterStore} from "~/lib/puter";

const Navbar = () => {
    // Only subscribe to what we need — prevents re-renders on unrelated store changes
    const isAuthenticated = usePuterStore((s) => s.auth.isAuthenticated);
    const signOut = usePuterStore((s) => s.auth.signOut);

    return (
        <nav className="navbar">
            <Link to="/">
                <p className="text-2xl font-bold text-gradient">ResumeMatch</p>
            </Link>
            <div className="flex items-center gap-3">
                <Link to="/upload" className="primary-button w-fit">
                    Upload Resume
                </Link>
                {isAuthenticated && (
                    <button
                        onClick={signOut}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all text-sm font-medium"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Sign Out
                    </button>
                )}
            </div>
        </nav>
    )
}
export default Navbar
