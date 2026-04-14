import { Navigate } from 'react-router-dom';
import { validateTeacherAccess } from '../utils/teacherValidation';
import { validateStudentAccess } from '../utils/studentValidation';

const ProtectedRoute = ({ children, role }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is a teacher, verify their email is in the whitelist
  if (user.role === 'teacher' && !validateTeacherAccess(user.email)) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  // If user is a student, verify their email is allowed
  if (user.role === 'student' && !validateStudentAccess(user.email)) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  // If user has a different role, redirect to their appropriate dashboard
  if (user.role !== role) {
    switch (user.role) {
      case 'teacher':
        return <Navigate to="/teacher" replace />;
      case 'student':
        return <Navigate to="/student" replace />;
      case 'admin':
        return <Navigate to="/admin" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;