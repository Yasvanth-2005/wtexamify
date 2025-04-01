import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, BookOpen, Loader2, User } from 'lucide-react';
import Allapi from '../utils/common';

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

const StudentPanel = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startLoading, setStartLoading] = useState(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  
  // Function to capitalize email prefix
  const formatEmail = (email) => {
    if (!email) return '';
    const [prefix, domain] = email.split('@');
    return `${prefix.toUpperCase()}@${domain}`;
  };
console.log("user pic: ",capitalize(user?.email?.split('@')[0]));
  useEffect(() => {
    fetchStartedExams();
  }, []);

  const fetchStartedExams = async () => {
    try {
      const response = await fetch(Allapi.getStartedExams.url, {
        headers: {
          Authorization: localStorage.getItem('token'),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch exams');
      setExams(data.exams || []);
    } catch (error) {
      toast.error('Failed to fetch exams');
    } finally {
      setLoading(false);
    }
  };

  const startExam = async (examId) => {
    try {
      setStartLoading(examId);
      const response = await fetch(Allapi.createAnswerSheet.url, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exam_id: examId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create answer sheet');
      navigate(`/exam-session/${data.answerSheet.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to start exam');
    } finally {
      setStartLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute w-full h-full border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute border-4 border-blue-300 rounded-full top-1 left-1 w-14 h-14 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500/40">
                <img
                  src={`https://intranet.rguktn.ac.in/SMS/usrphotos/user/${capitalize(user?.email?.split('@')[0])}.jpg`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXVzZXIiPjxwYXRoIGQ9Ik0xOSAyMXYtMmE0IDQgMCAwIDAtNC00SDlhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+';
                    e.target.className = 'w-full h-full object-contain p-2 text-gray-400';
                  }}
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{formatEmail(user?.email)}</h2>
                <p className="text-gray-400">Student</p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.clear();
                navigate('/login');
              }}
              className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-all duration-300"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Available Exams</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-white">{exam.name}</h2>
                  <span className="px-2 py-1 text-sm rounded-full bg-blue-500/20 text-blue-400">
                    {exam.exam_type}
                  </span>
                </div>
                <div className="space-y-2 text-gray-300">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Duration: {exam.duration} minutes</span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-2" />
                    <span>Questions: {exam.questions.length}</span>
                  </div>
                </div>
                <button
                  onClick={() => startExam(exam.id)}
                  disabled={startLoading === exam.id}
                  className={`w-full px-4 py-2 rounded-lg transition-all duration-300
                    ${startLoading === exam.id
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'text-green-400 bg-green-500/20 hover:bg-green-500/30'}`}
                >
                  {startLoading === exam.id ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Starting...
                    </div>
                  ) : (
                    'Start Exam'
                  )}
                </button>
              </div>
            </div>
          ))}

          {exams.length === 0 && (
            <div className="col-span-full bg-gray-800 rounded-xl border-2 border-blue-500/20 p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-gray-400" />
              <h3 className="mt-4 text-xl font-semibold text-white">No Active Exams</h3>
              <p className="mt-2 text-gray-400">There are no exams available right now</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentPanel;