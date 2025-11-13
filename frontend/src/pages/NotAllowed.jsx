import { useNavigate } from "react-router-dom";
import { AlertCircle, LogOut } from "lucide-react";

const NotAllowed = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>

        <p className="text-gray-400 mb-2">
          Your student ID is not registered in the system.
        </p>

        <p className="text-gray-500 text-sm mb-8">
          Please contact your administrator if you believe this is an error.
        </p>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300"
        >
          <LogOut className="w-5 h-5" />
          Return to Login
        </button>
      </div>
    </div>
  );
};

export default NotAllowed;
