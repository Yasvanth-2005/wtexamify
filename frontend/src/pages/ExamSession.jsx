// import { useState, useEffect } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import toast from 'react-hot-toast';
// import { RefreshCw, Brain } from 'lucide-react';
// import Allapi from '../utils/common';
// import CodeMirror from '@uiw/react-codemirror';
// import { javascript } from '@codemirror/lang-javascript';
// import { dracula } from '@uiw/codemirror-theme-dracula';

// const ExamSession = () => {
//   const { id: answerSheetId } = useParams();
//   const navigate = useNavigate();
//   const [answerSheet, setAnswerSheet] = useState(null);
//   const [answers, setAnswers] = useState({});
//   const [copied, setCopied] = useState(false);
//   const [passcode, setPasscode] = useState('');
//   const [showPasscodeModal, setShowPasscodeModal] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [timeLeft, setTimeLeft] = useState(null);
//   const [showRefreshModal, setShowRefreshModal] = useState(false);
//   const [refreshCode, setRefreshCode] = useState('');
//   const [refreshLoading, setRefreshLoading] = useState(false);
//   const [aiEvaluating, setAiEvaluating] = useState(false);
//   const [aiScore, setAiScore] = useState(null);
//   const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const answerSheetResponse = await fetch(Allapi.getAnswerSheetById.url(answerSheetId), {
//           headers: {
//             'Authorization': localStorage.getItem('token')
//           }
//         });
        
//         if (!answerSheetResponse.ok) throw new Error('Failed to fetch answer sheet');
//         const answerSheetData = await answerSheetResponse.json();
//         setAnswerSheet(answerSheetData.answerSheet);

//         // Initialize answers from existing data if any
//         if (answerSheetData.answerSheet.data) {
//           const initialAnswers = {};
//           answerSheetData.answerSheet.data.forEach(answer => {
//             const question = Object.keys(answer)[0];
//             initialAnswers[question] = answer[question];
//           });
//           setAnswers(initialAnswers);
//         }

//         // Set initial copied status
//         setCopied(answerSheetData.answerSheet.copied || false);

//         // Initialize timer
//         if (answerSheetData.answerSheet.duration) {
//           const startTime = new Date(answerSheetData.answerSheet.created_at.$date || answerSheetData.answerSheet.created_at).getTime();
//           const currentTime = new Date().getTime();
//           const elapsedTime = Math.floor((currentTime - startTime) / 1000);
//           const remainingTime = Math.max(0, answerSheetData.answerSheet.duration * 60 - elapsedTime);
//           setTimeLeft(remainingTime);
//         }

//         setLoading(false);
//       } catch (error) {
//         toast.error('Failed to load exam data');
//         console.error('Error loading exam:', error);
//         navigate('/student');
//       }
//     };

//     fetchData();
//   }, [answerSheetId, navigate]);

//   useEffect(() => {
//     if (timeLeft === null) return;

//     const timer = setInterval(() => {
//       setTimeLeft(prev => {
//         if (prev <= 1) {
//           clearInterval(timer);
//           handleSubmit();
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);

//     return () => clearInterval(timer);
//   }, [timeLeft]);

//   useEffect(() => {
//     const handleVisibilityChange = () => {
//       if (document.hidden && !copied && !answerSheet?.submit_status) {
//         markAsCopied();
//       }
//     };

//     const handleResize = () => {
//       if (!copied && !answerSheet?.submit_status) {
//         markAsCopied();
//       }
//     };

//     const handleBeforeUnload = (e) => {
//       if (!copied && !answerSheet?.submit_status) {
//         e.preventDefault();
//         markAsCopied();
//         e.returnValue = '';
//       }
//     };

//     document.addEventListener('visibilitychange', handleVisibilityChange);
//     window.addEventListener('resize', handleResize);
//     window.addEventListener('beforeunload', handleBeforeUnload);

//     return () => {
//       document.removeEventListener('visibilitychange', handleVisibilityChange);
//       window.removeEventListener('resize', handleResize);
//       window.removeEventListener('beforeunload', handleBeforeUnload);
//     };
//   }, [copied, answerSheet]);

//   const handleRefreshQuestions = async () => {
//     if (refreshCode !== 'directedbyvasu') {
//       toast.error('Invalid refresh code');
//       return;
//     }

//     try {
//       setRefreshLoading(true);
//       const response = await fetch(Allapi.refreshAnswerSheet.url(answerSheetId), {
//         method: 'PUT',
//         headers: {
//           'Authorization': localStorage.getItem('token')
//         }
//       });
      
//       if (!response.ok) throw new Error('Failed to refresh answer sheet');
      
//       const refreshedData = await response.json();
//       setAnswerSheet(refreshedData.answerSheet);
//       setAnswers({});
//       setShowRefreshModal(false);
//       setRefreshCode('');
//       toast.success('Questions refreshed successfully');
//     } catch (error) {
//       toast.error('Failed to refresh questions');
//     } finally {
//       setRefreshLoading(false);
//     }
//   };

//   const markAsCopied = async () => {
//     if (copied || answerSheet?.submit_status) return;

//     try {
//       const response = await fetch(Allapi.assignCopied.url(answerSheetId), {
//         method: 'PUT',
//         headers: {
//           'Authorization': localStorage.getItem('token'),
//         },
//       });

//       if (!response.ok) throw new Error('Failed to mark as copied');
      
//       setCopied(true);
//       setShowPasscodeModal(true);
//       toast.error('You have been caught cheating!');
//     } catch (error) {
//       console.error('Error marking as copied:', error);
//     }
//   };

//   const handleRemoveCopied = async () => {
//     try {
//       const response = await fetch(Allapi.removeCopied.url(answerSheetId), {
//         method: 'PUT',
//         headers: {
//           'Authorization': localStorage.getItem('token'),
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ passcode }),
//       });

//       if (!response.ok) throw new Error('Invalid passcode');

//       setCopied(false);
//       setAnswers({})
//       setShowPasscodeModal(false);
//       setPasscode('');
//       toast.success('Copying status removed');
//     } catch (error) {
//       toast.error('Invalid passcode');
//     }
//   };

//   const handleSubmit = async () => {
//     try {
//       // setLoading(true);
//       setAiEvaluating(true);
//       let aiScore = null;
      
//       if (answerSheet?.exam_type !== 'internal') {
//         try {
//           const aiResponse = await fetch(Allapi.aiScore.url, {
//             method: 'POST',
//             headers: {
//               'Authorization': localStorage.getItem('token'),
//               'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//               prompt: `Please evaluate these answers and provide a single numerical score out of 100. Do not include any explanation or additional text. If all answers are wrong, return 0. Only return the number:\n${JSON.stringify(answers)}`,
//             }),
//           });

//           // console.log("ai : ",aiResponse)

//           if (aiResponse.ok) {
//             const aiData = await aiResponse.json();
//             // console.log("aidata: ",aiData)
//             aiScore = parseFloat(aiData.response);
//             setAiScore(aiScore);
//             // console.log("ai score: ",aiScore)
//             // Wait for animation to complete
//             await new Promise(resolve => setTimeout(resolve, 3000));
//           }
//         } catch (error) {
//           console.error('AI scoring failed:', error);
//           // Continue with submission even if AI scoring fails
//         }
//       }

//       // Format answers for submission
//       const formattedAnswers = answerSheet.data.map(questionObj => {
//         const question = Object.keys(questionObj)[0];
//         return {  [question]: answers[question] ? answers[question].replace(/\r\n/g, "\n") : "" 
//         };
//       });

//       // Submit the exam
//       setLoading(true)
//       const response = await fetch(Allapi.submitAnswerSheet.url, {
//         method: 'PUT',
//         headers: {
//           'Authorization': localStorage.getItem('token'),
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           answer_sheet_id: answerSheetId,
//           answers: formattedAnswers,
//           ai_score: aiScore,
//         }),
//       });

//       if (!response.ok) throw new Error('Failed to submit answer sheet');

//       toast.success('Exam submitted successfully');
//       navigate('/student');
//     } catch (error) {
//       toast.error(error.message || 'Failed to submit exam');
//       setLoading(false);
//     } finally {
//       setAiEvaluating(false);
//     }
//   };

//   const formatTime = (seconds) => {
//     const minutes = Math.floor(seconds / 60);
//     const remainingSeconds = seconds % 60;
//     return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-900 flex items-center justify-center">
//         <div className="relative w-16 h-16">
//           <div className="absolute w-full h-full border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
//           <div className="absolute border-4 border-blue-300 rounded-full top-1 left-1 w-14 h-14 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
//         </div>
//       </div>
//     );
//   }

//   if (aiEvaluating) {
//     return (
//       <div className="min-h-screen bg-gray-900 flex items-center justify-center">
//         <div className="bg-gray-800 rounded-xl p-8 text-center max-w-lg">
//           {aiScore === null ? (
//             <>
//               <div className="relative w-24 h-24 mx-auto mb-6">
//                 <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping opacity-75"></div>
//                 <div className="relative flex items-center justify-center w-full h-full">
//                   <Brain className="w-16 h-16 text-blue-500 animate-pulse" />
//                 </div>
//               </div>
//               <h2 className="text-2xl font-bold text-white mb-4">AI is evaluating your answers...</h2>
//               <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
//                 <div className="h-full bg-blue-500 animate-loading-bar"></div>
//               </div>
//             </>
//           ) : (
//             <div className="space-y-6">
//               <div className="text-6xl font-bold text-blue-500 animate-score-reveal">{aiScore}</div>
//               <p className="text-xl text-white mb-2">Your AI-Generated Score</p>
//               <div className="flex items-center justify-center">
//                 <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
//                 <p className="text-gray-400">Submitting your exam...</p>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   }

//   if (!answerSheet) {
//     return (
//       <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
//         <div className="bg-gray-800 rounded-xl border-2 border-red-500/20 p-8 text-center max-w-lg">
//           <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
//           <p className="text-gray-400 mb-6">Failed to load exam data. Please try again.</p>
//           <button
//             onClick={() => navigate('/student')}
//             className="px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
//           >
//             Return to Dashboard
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (answerSheet.submit_status) {
//     return (
//       <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
//         <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-8 text-center max-w-lg">
//           <h2 className="text-2xl font-bold text-white mb-4">Exam Already Submitted</h2>
//           <p className="text-gray-400 mb-6">You have already submitted this exam.</p>
//           <button
//             onClick={() => navigate('/student')}
//             className="px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
//           >
//             Return to Dashboard
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (copied) {
//     return (
//       <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
//         <div className="bg-gray-800 rounded-xl border-2 border-red-500/20 p-8 text-center max-w-lg">
//           <h2 className="text-2xl font-bold text-red-400 mb-4">Caught Cheating</h2>
//           <p className="text-gray-400 mb-6">You have been marked for copying. Please enter the passcode to continue.</p>
//           <div className="space-y-4">
//             <input
//               type="password"
//               value={passcode}
//               onChange={(e) => setPasscode(e.target.value)}
//               placeholder="Enter passcode"
//               className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
//             />
//             <button
//               onClick={handleRemoveCopied}
//               className="w-full px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
//             >
//               Submit Passcode
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Extract questions from answerSheet.data
//   const questions = answerSheet.data ? answerSheet.data.map(answer => Object.keys(answer)[0]) : [];
//   const currentQuestion = questions[activeQuestionIndex];

//   return (
//     <div className="min-h-screen bg-gray-900 p-8">
//       <div className="max-w-4xl mx-auto space-y-8">
//         <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-6">
//           <div className="flex justify-between items-center mb-6">
//             <div className="flex items-center gap-4">
//               <h1 className="text-2xl font-bold text-white">Exam Session</h1>
//               <span className="px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded-lg">
//                 Set {answerSheet.set_number}
//               </span>
//               <button
//                 onClick={() => setShowRefreshModal(true)}
//                 className="flex items-center px-3 py-2 text-sm text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
//               >
//                 <RefreshCw className="w-4 h-4 mr-2" />
//                 Refresh Questions
//               </button>
//             </div>
//             {timeLeft !== null && (
//               <div className={`text-lg font-mono ${timeLeft < 300 ? 'text-red-400' : 'text-blue-400'}`}>
//                 Time Left: {formatTime(timeLeft)}
//               </div>
//             )}
//           </div>

//           {answerSheet.exam_type === 'external' ? (
//             <div className="space-y-6">
//               {/* Question navigation */}
//               <div className="flex flex-wrap gap-2">
//                 {questions.map((q, index) => (
//                   <button
//                     key={index}
//                     onClick={() => setActiveQuestionIndex(index)}
//                     className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 ${
//                       activeQuestionIndex === index
//                         ? 'bg-blue-500 text-white'
//                         : answers[q]
//                         ? 'bg-blue-500/20 text-blue-400'
//                         : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
//                     }`}
//                   >
//                     {index + 1}
//                   </button>
//                 ))}
//               </div>

//               {/* Current question */}
//               <div className="space-y-4">
//                 <h3 className="text-lg text-white">Question {activeQuestionIndex + 1}</h3>
//                 <p className="text-white">{currentQuestion}</p>
//                 {/* <textarea
//                   value={answers[currentQuestion] || ''}
//                   onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion]: e.target.value }))}
//                   className="w-full h-64 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
//                   placeholder="Enter your answer..."
//                 /> */}
//               <div className="w-full h-64 border border-gray-600 rounded-lg overflow-hidden">
//                 <CodeMirror
//                   value={answers[currentQuestion] || ""}
//                   height="100%"
//                   theme={dracula}
//                   extensions={[javascript()]}
//                   onChange={(value) => {
//                     setAnswers((prev) => ({ ...prev, [currentQuestion]: value }));
//                   }}
//                   style={{ height: '100%' }}
//                   basicSetup={{
//                     lineNumbers: true,
//                     highlightActiveLineGutter: true,
//                     highlightSpecialChars: true,
//                     foldGutter: true,
//                     drawSelection: true,
//                     dropCursor: true,
//                     allowMultipleSelections: true,
//                     indentOnInput: true,
//                     syntaxHighlighting: true,
//                     bracketMatching: true,
//                     closeBrackets: true,
//                     autocompletion: true,
//                     rectangularSelection: true,
//                     crosshairCursor: true,
//                     highlightActiveLine: true,
//                     highlightSelectionMatches: true,
//                     closeBracketsKeymap: true,
//                     defaultKeymap: true,
//                     searchKeymap: true,
//                     historyKeymap: true,
//                     foldKeymap: true,
//                     completionKeymap: true,
//                     lintKeymap: true,
//                   }}
//                   preserveScrollPosition={true}
//                   indentWithTab={true}
//                 />
//               </div>
//               </div>

//               {/* Navigation buttons */}
//               <div className="flex justify-between">
//                 <button
//                   onClick={() => setActiveQuestionIndex(prev => Math.max(0, prev - 1))}
//                   disabled={activeQuestionIndex === 0}
//                   className={`px-4 py-2 rounded-lg transition-all duration-300 ${
//                     activeQuestionIndex === 0
//                       ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
//                       : 'bg-gray-700 text-white hover:bg-gray-600'
//                   }`}
//                 >
//                   Previous
//                 </button>
//                 {activeQuestionIndex < questions.length - 1 ? (
//                   <button
//                     onClick={() => setActiveQuestionIndex(prev => prev + 1)}
//                     className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
//                   >
//                     Next
//                   </button>
//                 ) : (
//                   <button
//                     onClick={handleSubmit}
//                     className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300"
//                   >
//                     Submit Exam
//                   </button>
//                 )}
//               </div>
//             </div>
//           ) : (
//             <div className="space-y-6">
//               {questions.map((question, index) => (
//                 <div key={index} className="space-y-2">
//                   <h3 className="text-lg text-white">Question {index + 1}: {question}</h3>
//                   {answerSheet.exam_type === 'internal' ? (
//                     <p className="text-gray-400 italic">This is an internal exam. No answers required.</p>
//                   ) : (
//                     <textarea
//                       value={answers[question] || ''}
//                       onChange={(e) => setAnswers(prev => ({ ...prev, [question]: e.target.value }))}
//                       className="w-full h-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
//                       placeholder="Enter your answer..."
//                     />
//                   )}
//                 </div>
//               ))}
//               <div className="mt-8 flex justify-end">
//                 <button
//                   onClick={handleSubmit}
//                   disabled={loading}
//                   className="px-6 py-3 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   {loading ? 'Submitting...' : 'Submit Exam'}
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Refresh Questions Modal */}
//       {showRefreshModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
//           <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
//             <h2 className="text-xl font-bold text-white mb-4">Refresh Questions</h2>
//             <p className="text-gray-400 mb-4">Enter the refresh code to continue</p>
//             <input
//               type="password"
//               value={refreshCode}
//               onChange={(e) => setRefreshCode(e.target.value)}
//               placeholder="Enter refresh code"
//               className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
//             />
//             <div className="flex justify-end gap-2">
//               <button
//                 onClick={() => {
//                   setShowRefreshModal(false);
//                   setRefreshCode('');
//                 }}
//                 className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleRefreshQuestions}
//                 disabled={refreshLoading}
//                 className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
//               >
//                 {refreshLoading ? (
//                   <>
//                     <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
//                     Refreshing...
//                   </>
//                 ) : (
//                   'Refresh'
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ExamSession;



import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RefreshCw, Brain, ArrowLeft } from 'lucide-react';
import Allapi from '../utils/common';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { TypeAnimation } from "react-type-animation";

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
const formatAiRemarks = (text) => {
  return text
    .split('**')
    .map((part, index) => {
      if (index % 2 === 1) { // This is inside ** **
        return `<strong>${part}</strong>`;
      }
      // Replace periods followed by ** with period and newline
      return part.replace(/\.\s*\*\*/g, '.<br/>**');
    })
    .join('')
    .split('. ')
    .join('.<br/><br/>');
};

const ExamSession = () => {
  const { id: answerSheetId } = useParams();
  const navigate = useNavigate();
  const [answerSheet, setAnswerSheet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [copied, setCopied] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshCode, setRefreshCode] = useState('');
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [aiEvaluating, setAiEvaluating] = useState(false);
  const [aiScore, setAiScore] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [aiAnswerStatus, setAiAnswerStatus] = useState([]);
  const [aiRemarks, setAiRemarks] = useState('');
  const [showResults, setShowResults] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const answerSheetResponse = await fetch(Allapi.getAnswerSheetById.url(answerSheetId), {
          headers: {
            'Authorization': localStorage.getItem('token')
          }
        });
        
        if (!answerSheetResponse.ok) throw new Error('Failed to fetch answer sheet');
        const answerSheetData = await answerSheetResponse.json();
        setAnswerSheet(answerSheetData.answerSheet);

        if (answerSheetData.answerSheet.data) {
          const initialAnswers = {};
          answerSheetData.answerSheet.data.forEach(answer => {
            const question = Object.keys(answer)[0];
            initialAnswers[question] = answer[question];
          });
          setAnswers(initialAnswers);
        }

        setCopied(answerSheetData.answerSheet.copied || false);

        if (answerSheetData.answerSheet.duration) {
          const startTime = new Date(answerSheetData.answerSheet.created_at.$date || answerSheetData.answerSheet.created_at).getTime();
          const currentTime = new Date().getTime();
          const elapsedTime = Math.floor((currentTime - startTime) / 1000);
          const remainingTime = Math.max(0, answerSheetData.answerSheet.duration * 60 - elapsedTime);
          setTimeLeft(remainingTime);
        }

        setLoading(false);
      } catch (error) {
        toast.error('Failed to load exam data');
        console.error('Error loading exam:', error);
        navigate('/student');
      }
    };

    fetchData();
  }, [answerSheetId, navigate]);

  useEffect(() => {
    if (timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

    useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !copied && !answerSheet?.submit_status) {
        markAsCopied();
      }
    };

    const handleResize = () => {
      if (!copied && !answerSheet?.submit_status) {
        markAsCopied();
      }
    };

    const handleBeforeUnload = (e) => {
      if (!copied && !answerSheet?.submit_status) {
        e.preventDefault();
        markAsCopied();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [copied, answerSheet]);

  const handleRefreshQuestions = async () => {
    if (refreshCode !== 'directedbyvasu') {
      toast.error('Invalid refresh code');
      return;
    }

    try {
      setRefreshLoading(true);
      const response = await fetch(Allapi.refreshAnswerSheet.url(answerSheetId), {
        method: 'PUT',
        headers: {
          'Authorization': localStorage.getItem('token')
        }
      });
      
      if (!response.ok) throw new Error('Failed to refresh answer sheet');
      
      const refreshedData = await response.json();
      setAnswerSheet(refreshedData.answerSheet);
      setAnswers({});
      setShowRefreshModal(false);
      setRefreshCode('');
      toast.success('Questions refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh questions');
    } finally {
      setRefreshLoading(false);
    }
  };

  const markAsCopied = async () => {
    if (copied || answerSheet?.submit_status) return;

    try {
      const response = await fetch(Allapi.assignCopied.url(answerSheetId), {
        method: 'PUT',
        headers: {
          'Authorization': localStorage.getItem('token'),
        },
      });

      if (!response.ok) throw new Error('Failed to mark as copied');
      
      setCopied(true);
      setShowPasscodeModal(true);
      toast.error('You have been caught cheating!');
    } catch (error) {
      console.error('Error marking as copied:', error);
    }
  };

  const handleRemoveCopied = async () => {
    try {
      const response = await fetch(Allapi.removeCopied.url(answerSheetId), {
        method: 'PUT',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) throw new Error('Invalid passcode');

      setCopied(false);
      setAnswers({});
      setShowPasscodeModal(false);
      setPasscode('');
      toast.success('Copying status removed');
    } catch (error) {
      toast.error('Invalid passcode');
    }
  };

  const evaluateAnswers = async () => {
    setAiEvaluating(true);
    let finalAiScore = null;
    const statuses = [];
    
    try {
      // Evaluate each answer individually
      for (let i = 0; i < answerSheet.data.length; i++) {
        const question = Object.keys(answerSheet.data[i])[0];
        const answer = answers[question] || '';
        
        const statusResponse = await fetch(Allapi.aiScore.url, {
          method: 'POST',
          headers: {
            'Authorization': localStorage.getItem('token'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `Analyze the following codes in relation to the question "${question}". Return only strictly!! "will execute" or "will not execute". No other text should be included.

            Question: ${question}
            Answer: ${answer}`,
          }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          statuses.push({
            questionNumber: i + 1,
            status: statusData.response.trim().toLowerCase(),
          });
        }
      }

      // Get overall remarks
      const remarksResponse = await fetch(Allapi.aiScore.url, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Analyze these JavaScript answers in relation to their respective questions and provide brief, constructive feedback about the overall code quality and potential improvements. Keep it under 100 words. Below are the questions and answers:

          ${answerSheet.data.map((item, index) => {
            const question = Object.keys(item)[0];
            const answer = answers[question] || '';
            return `Question ${index + 1}: ${question}\nAnswer: ${answer}\n`;
          }).join("\n")}`,
        }),
      });

      if (remarksResponse.ok) {
        const remarksData = await remarksResponse.json();
        setAiRemarks(remarksData.response);
      }

      // Calculate final score
      const scoreResponse = await fetch(Allapi.aiScore.url, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Based on these answers, provide a single numerical score out of 100. Only return the number: ${JSON.stringify(answers)}`,
        }),
      });

      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        finalAiScore = parseFloat(scoreData.response);
      }

      setAiAnswerStatus(statuses);
      setAiScore(finalAiScore);
      setShowResults(true);
      
      return finalAiScore;
    } catch (error) {
      console.error('AI evaluation failed:', error);
      return null;
    } finally {
      setAiEvaluating(false);
    }
  };

  const formatEmail = (email) => {
    if (!email) return '';
    const [prefix, domain] = email.split('@');
    return `${prefix.toUpperCase()}@${domain}`;
  };

  const handleSubmit = async () => {
    try {
      let aiScore = null;
      
      if (answerSheet?.exam_type === 'external') {
        aiScore = await evaluateAnswers();
      }

      const formattedAnswers = answerSheet.data.map(questionObj => {
        const question = Object.keys(questionObj)[0];
        return { [question]: answers[question] ? answers[question].replace(/\r\n/g, "\n") : "" };
      });

      setLoading(true);
      const response = await fetch(Allapi.submitAnswerSheet.url, {
        method: 'PUT',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer_sheet_id: answerSheetId,
          answers: formattedAnswers,
          ai_score: aiScore,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit answer sheet');

      toast.success('Exam submitted successfully');
      setLoading(false)
      setAnswerSheet(prevState => ({
        ...prevState,  // Keep the previous state values
        submit_status: true,  // Update only the submit_status
      }));
      if (answerSheet?.exam_type !== 'external') {
        navigate('/student');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit exam');
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  if (aiEvaluating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl p-8 text-center max-w-lg">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative flex items-center justify-center w-full h-full">
              <Brain className="w-16 h-16 text-blue-500 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">AI is evaluating your answers...</h2>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-loading-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Exam Results</h2>
          
          <div className="mb-8">
            <div className="text-6xl font-bold text-blue-500 text-center mb-4">{aiScore}</div>
            <p className="text-xl text-gray-400 text-center">Your AI-Generated Score</p>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Answer Status:</h3>
            {aiAnswerStatus.map((status, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-700 p-4 rounded-lg">
                <span className="text-white">Question {status.questionNumber}</span>
                <span className={status.status === 'will execute' ? 'text-green-400' : 'text-red-400'}>
                  {status.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">AI Remarks:</h3>
            <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600">
              <div 
                className="text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatAiRemarks(aiRemarks) }}
              />
            </div>
          </div>

          <button
            onClick={() => navigate('/student')}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!answerSheet) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl border-2 border-red-500/20 p-8 text-center max-w-lg">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-gray-400 mb-6">Failed to load exam data. Please try again.</p>
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (answerSheet.submit_status) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-8 text-center max-w-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Exam Already Submitted</h2>
          <p className="text-gray-400 mb-6">You have already submitted this exam.</p>
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (copied) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl border-2 border-red-500/20 p-8 text-center max-w-lg">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Caught Cheating</h2>
          <p className="text-gray-400 mb-6">You have been marked for copying. Please enter the passcode to continue.</p>
          <div className="space-y-4">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleRemoveCopied}
              className="w-full px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
            >
              Submit Passcode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract questions from answerSheet.data
  const questions = answerSheet.data ? answerSheet.data.map(answer => Object.keys(answer)[0]) : [];
  const currentQuestion = questions[activeQuestionIndex];

  if (answerSheet.exam_type === 'external' && !examStarted) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/student')}
              className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowRefreshModal(true)}
                className="flex items-center px-3 py-2 text-sm text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Questions
              </button>
              {timeLeft !== null && (
                <div className={`text-lg font-mono ${timeLeft < 300 ? 'text-red-400' : 'text-blue-400'}`}>
                  Time Left: {formatTime(timeLeft)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-8">
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">External Exam</h1>
                <p className="text-gray-400">Set {answerSheet.set_number}</p>
              </div>

              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div key={index} className="bg-gray-700 p-6 rounded-lg">
                    <h3 className="text-lg text-white mb-4">Question {index + 1}</h3>
                    <p className="text-gray-300">{question}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setExamStarted(true)}
                className="w-full px-6 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 text-lg font-semibold"
              >
                Enter Exam
              </button>
            </div>
          </div>
        </div>
        {showRefreshModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Refresh Questions</h2>
            <p className="text-gray-400 mb-4">Enter the refresh code to continue</p>
            <input
              type="password"
              value={refreshCode}
              onChange={(e) => setRefreshCode(e.target.value)}
              placeholder="Enter refresh code"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRefreshModal(false);
                  setRefreshCode('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefreshQuestions}
                disabled={refreshLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              >
                {refreshLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
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
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Exam Session</h1>
              <span className="px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded-lg">
                Set {answerSheet.set_number}
              </span>
              <button
                onClick={() => setShowRefreshModal(true)}
                className="flex items-center px-3 py-2 text-sm text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Questions
              </button>
            </div>
            {timeLeft !== null && (
              <div className={`text-lg font-mono ${timeLeft < 300 ? 'text-red-400' : 'text-blue-400'}`}>
                Time Left: {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {answerSheet.exam_type === 'external' ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {questions.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveQuestionIndex(index)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 ${
                      activeQuestionIndex === index
                        ? 'bg-blue-500 text-white'
                        : answers[q]
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-white">Question {activeQuestionIndex + 1}</h3>
                <p className="text-white">{currentQuestion}</p>
                <textarea
                   value={answers[currentQuestion] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion]: e.target.value }))}
                   className="w-full h-64 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter your answer..."
                 /> 
                {/* <div className="w-full h-64 border border-gray-600 rounded-lg overflow-hidden">
                  <CodeMirror
                    value={answers[currentQuestion] || ""}
                    height="100%"
                    theme={dracula}
                    extensions={[javascript()]}
                    onChange={(value) => {
                      setAnswers((prev) => ({ ...prev, [currentQuestion]: value }));
                    }}
                    style={{ height: '100%' }}
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLineGutter: true,
                      highlightSpecialChars: true,
                      foldGutter: true,
                      drawSelection: true,
                      dropCursor: true,
                      allowMultipleSelections: true,
                      indentOnInput: true,
                      syntaxHighlighting: true,
                      bracketMatching: true,
                      closeBrackets: true,
                      autocompletion: true,
                      rectangularSelection: true,
                      crosshairCursor: true,
                      highlightActiveLine: true,
                      highlightSelectionMatches: true,
                      closeBracketsKeymap: true,
                      defaultKeymap: true,
                      searchKeymap: true,
                      historyKeymap: true,
                      foldKeymap: true,
                      completionKeymap: true,
                      lintKeymap: true,
                    }}
                    preserveScrollPosition={true}
                    indentWithTab={true}
                  />
                </div> */}
                
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setActiveQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeQuestionIndex === 0}
                  className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                    activeQuestionIndex === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  Previous
                </button>
                {activeQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setActiveQuestionIndex(prev => prev + 1)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300"
                  >
                    Submit Exam
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={index} className="space-y-2">
                  <h3 className="text-lg text-white">Question {index + 1}: {question}</h3>
                  {answerSheet.exam_type === 'internal' ? (
                    <p className="text-gray-400 italic">This is an internal exam. No answers required.</p>
                  ) : (
                    <textarea
                      value={answers[question] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [question]: e.target.value }))}
                      className="w-full h-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Enter your answer..."
                    />
                  )}
                </div>
              ))}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Exam'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Refresh Questions Modal */}
      {showRefreshModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Refresh Questions</h2>
            <p className="text-gray-400 mb-4">Enter the refresh code to continue</p>
            <input
              type="password"
              value={refreshCode}
              onChange={(e) => setRefreshCode(e.target.value)}
              placeholder="Enter refresh code"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRefreshModal(false);
                  setRefreshCode('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefreshQuestions}
                disabled={refreshLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              >
                {refreshLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSession;