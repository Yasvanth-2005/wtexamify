import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Allapi from "../utils/common";
import { validateStudentAccess } from "../utils/studentValidation";

const GoogleCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (!code) {
          throw new Error("No authorization code found");
        }

        const response = await fetch(
          `${Allapi.backapi}/auth/googlecallback?code=${code}`
        );
        const data = await response.json();

        if (!response.ok) {
          // If access is denied, redirect to not-allowed page
          if (response.status === 403 || data.error?.includes("Access denied")) {
            localStorage.clear(); // Clear any existing auth data
            navigate("/not-allowed", { replace: true });
            return;
          }
          throw new Error(data.error || "Authentication failed");
        }

        console.log("Auth response:", data); // Debug log

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        toast.success("Successfully logged in!");

        // Navigate based on user role
        if (data.user && data.user.role) {
          // For students, check if they are allowed (must be in cse4 list)
          if (data.user.role === "student") {
            const isAllowed = validateStudentAccess(data.user.email, "cse4");
            if (!isAllowed) {
              console.log("Student ID not found in cse4:", data.user.email);
              localStorage.clear(); // Clear auth data
              navigate("/not-allowed", { replace: true });
              return;
            }
          }
          // For teachers, they are already validated by backend whitelist
          // No additional check needed for teachers

          const targetPath = `/${data.user.role}`;
          console.log("Navigating to:", targetPath); // Debug log
          navigate(targetPath, { replace: true });
        } else {
          console.error("User role not found in response:", data);
          localStorage.clear(); // Clear auth data
          navigate("/login", { replace: true });
        }
      } catch (error) {
        console.error("Authentication error:", error);
        toast.error("Authentication failed");
        navigate("/login");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-lg text-gray-300">Authenticating...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
