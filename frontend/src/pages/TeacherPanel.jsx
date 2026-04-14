import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Plus,
  Clock,
  BookOpen,
  Download,
  Loader,
  Mail,
  Printer,
  Trash2,
} from "lucide-react";
import Allapi from "../utils/common";
import studentsData from "../utils/students_data.json";
//
const TeacherPanel = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState(null);
  const [answerSheets, setAnswerSheets] = useState([]);
  const [showAnswerSheets, setShowAnswerSheets] = useState(false);
  const [questionSets, setQuestionSets] = useState([]);
  const [showQuestionSets, setShowQuestionSets] = useState(false);
  const [loadingAnswerSheets, setLoadingAnswerSheets] = useState(false);
  const [loadingQuestionSets, setLoadingQuestionSets] = useState(false);
  const [downloadingSheets, setDownloadingSheets] = useState({});
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [sendingEmails, setSendingEmails] = useState({});
  const [loadingExamStatus, setLoadingExamStatus] = useState({});
  const [deletingExams, setDeletingExams] = useState({});
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [sendingBulkEmails, setSendingBulkEmails] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    fetchExams();
    // Get available classes from students_data.json
    const classes = Object.keys(studentsData);
    setAvailableClasses(classes);
  }, []);

  // Extract ID number from email (first 7 characters before @)
  const extractIdNumber = (email) => {
    if (!email) return "";
    const prefix = email.split("@")[0];
    return prefix.substring(0, 7).toUpperCase();
  };

  const handleSendEmails = async (examId) => {
    try {
      setSendingEmails((prev) => ({ ...prev, [examId]: true }));
      const response = await fetch(Allapi.sendEmails.url, {
        method: Allapi.sendEmails.method,
        headers: {
          Authorization: localStorage.getItem("token"),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send emails");
      }

      toast.success("Emails sent successfully");
    } catch (error) {
      toast.error(error.message || "Failed to send emails");
    } finally {
      setSendingEmails((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const handleSendBulkEmails = async () => {
    if (!selectedClass) {
      toast.error("Please select a class");
      return;
    }

    try {
      setSendingBulkEmails(true);
      const response = await fetch(Allapi.sendEmails.url, {
        method: Allapi.sendEmails.method,
        headers: {
          Authorization: localStorage.getItem("token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ class: selectedClass }),
      });

      const data = await response.json();

      if (!response.ok) {
        // All emails failed
        const errorMsg = data.error || "Failed to send emails";
        if (data.failedEmails && data.failedEmails.length > 0) {
          toast.error(
            `${errorMsg}. Failed emails: ${data.failedEmails
              .slice(0, 5)
              .join(", ")}${data.failedEmails.length > 5 ? "..." : ""}`
          );
        } else {
          toast.error(errorMsg);
        }
        return;
      }

      // Handle success or partial success
      if (
        response.status === 206 ||
        (data.failedCount && data.failedCount > 0)
      ) {
        // Partial success - some emails failed
        toast.success(data.message || `Emails sent with some failures`);
        if (data.failedEmails && data.failedEmails.length > 0) {
          console.warn("Failed emails:", data.failedEmails);
          // Show a warning toast with failed emails
          setTimeout(() => {
            toast.error(
              `Failed to send to ${
                data.failedCount
              } email(s): ${data.failedEmails.slice(0, 3).join(", ")}${
                data.failedEmails.length > 3 ? "..." : ""
              }`,
              { duration: 5000 }
            );
          }, 1000);
        }
      } else {
        // All emails sent successfully
        toast.success(data.message || `Emails sent successfully`);
      }

      setShowEmailModal(false);
      setSelectedClass("");
    } catch (error) {
      toast.error(error.message || "Failed to send emails");
    } finally {
      setSendingBulkEmails(false);
    }
  };

  const fetchExams = async () => {
    try {
      const response = await fetch(
        Allapi.getTeacherExams.url(user.container_id),
        {
          headers: {
            Authorization: localStorage.getItem("token"),
          },
          method: "GET",
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch exams");
      const sortedExams = (data.exams || []).sort((a, b) => {
        // Try to get dates
        const dateA = a.created_at?.$date ? new Date(a.created_at.$date) : a.created_at ? new Date(a.created_at) : null;
        const dateB = b.created_at?.$date ? new Date(b.created_at.$date) : b.created_at ? new Date(b.created_at) : null;

        // If both have valid dates and they are different, sort by date
        if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
          return dateB - dateA;
        }

        // Fallback to sorting by _id (which includes timestamp for MongoDB)
        // or just keep original order if IDs are missing
        const idA = a._id?.$oid || a._id || "";
        const idB = b._id?.$oid || b._id || "";
        return idB.toString().localeCompare(idA.toString());
      });
      setExams(sortedExams);
    } catch (error) {
      toast.error("Failed to fetch exams");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (examId, newStatus) => {
    try {
      setLoadingExamStatus((prev) => ({ ...prev, [examId]: true }));
      const response = await fetch(
        Allapi.updateExam.url.replace(":id", examId),
        {
          method: "PUT",
          headers: {
            Authorization: localStorage.getItem("token"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update exam status");
      }

      await fetchExams();
      toast.success(
        `Exam ${newStatus === "start" ? "started" : "stopped"} successfully`
      );
    } catch (error) {
      toast.error("Failed to update exam status");
    } finally {
      setLoadingExamStatus((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingExams((prev) => ({ ...prev, [examId]: true }));
      const response = await fetch(
        Allapi.deleteExam.url.replace(":id", examId),
        {
          method: "DELETE",
          headers: {
            Authorization: localStorage.getItem("token"),
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete exam");
      }

      toast.success("Exam deleted successfully");
      await fetchExams();
    } catch (error) {
      toast.error(error.message || "Failed to delete exam");
    } finally {
      setDeletingExams((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const fetchAnswerSheets = async (examId) => {
    try {
      setShowAnswerSheets(true);
      setSelectedExam(examId);
      setLoadingAnswerSheets(true);
      const response = await fetch(
        Allapi.getSubmittedAnswerSheets.url(examId),
        {
          headers: {
            Authorization: localStorage.getItem("token"),
          },
          method: "GET",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch answer sheets");
      }

      const data = await response.json();
      setAnswerSheets(data.submitted_answersheets || []);
    } catch (error) {
      toast.error("Failed to fetch answer sheets");
    } finally {
      setLoadingAnswerSheets(false);
    }
  };

  const fetchQuestionSets = async (examId) => {
    try {
      setShowQuestionSets(true);
      setSelectedExam(examId);
      setLoadingQuestionSets(true);
      const response = await fetch(`${Allapi.backapi}/exam/getsets/${examId}`, {
        headers: {
          Authorization: localStorage.getItem("token"),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch question sets");
      }

      const data = await response.json();
      setQuestionSets(data.question_sets || []);
    } catch (error) {
      toast.error("Failed to fetch question sets");
      setShowQuestionSets(false);
    } finally {
      setLoadingQuestionSets(false);
    }
  };

  const escapeHTML = (str) => {
    if (str === null || str === undefined) return "";
    return str
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const generatePrintContent = (answerSheet) => {
    return `
      <div class="answer-sheet" style="page-break-after: always;">
        <h2 style="margin-bottom: 20px;">Answer Sheet</h2>
        <p><strong>Student:</strong> ${answerSheet.student_name}</p>
        <p><strong>Set Number:</strong> ${answerSheet.set_number}</p>
        <p><strong>Copy Count:</strong> ${answerSheet.copy_count}</p>
        <p><strong>Ai Score:</strong> ${answerSheet.ai_score}</p>
        <hr style="margin: 20px 0;">
        ${answerSheet.data
          .map((item, index) => {
            const question = Object.keys(item)[0];
            const answer = item[question];
            return `
            <div class="question" style="margin-bottom: 20px;">
              <h3>Question ${index + 1}:</h3>
              <p>${escapeHTML(question)}</p>
              <div class="answer" style="margin-left: 20px; color: #444;">
                <strong>Answer:</strong>
                <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f4f4f4; padding: 10px; border-radius: 5px;">
                  ${escapeHTML(answer) || "No answer provided"}
                </pre>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  };
  // Generate PDF content for all answer sheets (ID Number, Question, Answer only)
  const generateAllPDFContent = (allSheets) => {
    return `
      <html>
        <head>
          <title>All Answer Sheets</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              font-size: 12px;
            }
            .answer-sheet-section {
              margin-bottom: 30px;
              page-break-after: always;
            }
            .student-info {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 15px;
              color: #2196F3;
              border-bottom: 2px solid #2196F3;
              padding-bottom: 10px;
            }
            .info-item {
              margin-bottom: 5px;
              font-size: 14px;
            }
            .info-label {
              font-weight: bold;
              color: #333;
            }
            .question-answer {
              margin-bottom: 20px;
              padding: 10px;
              border-left: 3px solid #4CAF50;
              background-color: #f9f9f9;
            }
            .question {
              font-weight: bold;
              margin-bottom: 8px;
              color: #333;
            }
            .answer {
              margin-left: 20px;
              color: #555;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            @media print {
              body { padding: 10px; }
              .answer-sheet-section { page-break-after: always; }
              .question-answer { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${allSheets
            .map((sheet) => {
              const idNumber = extractIdNumber(sheet.student_email);
              return `
              <div class="answer-sheet-section">
                <div class="student-info">
                  <div class="info-item">
                    <span class="info-label">Student Name:</span> ${escapeHTML(sheet.student_name || "N/A")}
                  </div>
                  <div class="info-item">
                    <span class="info-label">Set Number:</span> ${sheet.set_number || "N/A"}
                  </div>
                  <div class="info-item">
                    <span class="info-label">User ID Number:</span> ${idNumber || "N/A"}
                  </div>
                </div>
                ${sheet.data
                  .map((item, index) => {
                    const question = Object.keys(item)[0];
                    const answer = item[question] || "No answer provided";
                    return `
                    <div class="question-answer">
                      <div class="question">${escapeHTML(question)}</div>
                      <div class="answer">${escapeHTML(answer)}</div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            `;
            })
            .join("")}
        </body>
      </html>
    `;
  };

  const downloadAllPDF = async () => {
    try {
      setDownloadingAll(true);

      // Fetch all answer sheets with full details
      const allSheets = await Promise.all(
        answerSheets.map(async (sheet) => {
          const response = await fetch(
            Allapi.getAnswerSheetById.url(sheet.id),
            {
              headers: {
                Authorization: localStorage.getItem("token"),
              },
              method: "GET",
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch answer sheet ${sheet.id}`);
          }

          const data = await response.json();
          return data.answerSheet;
        })
      );

      // Generate PDF content
      const pdfContent = generateAllPDFContent(allSheets);

      // Use iframe to open print dialog (user can save as PDF from there)
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(pdfContent);
      iframe.contentWindow.document.close();

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 100);
        }, 250);
      };

      toast.success("Opening print dialog...");
    } catch (error) {
      toast.error("Failed to download answer sheets");
      console.error("Error downloading answer sheets:", error);
    } finally {
      setDownloadingAll(false);
    }
  };

  // Generate PDF content HTML
  const generatePDFContent = (data) => {
    return `
      <html>
        <head>
          <title>Answer Sheet</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .question { margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .question-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
            .answer-section { margin-top: 15px; margin-left: 20px; color: #444; white-space: pre-wrap; }
            .ai-section { margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #2196F3; border-radius: 4px; }
            .ai-explanation { margin-top: 10px; padding: 10px; background-color: #fff; border-radius: 4px; }
            .ai-overview { margin-top: 10px; padding: 10px; background-color: #e3f2fd; border-radius: 4px; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-left: 10px; }
            .status-execute { background-color: #4CAF50; color: white; }
            .status-not-execute { background-color: #f44336; color: white; }
            @media print {
              body { padding: 0; }
              .question { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Answer Sheet</h1>
          <p><strong>Student:</strong> ${data.answerSheet.student_name}</p>
          <p><strong>Set Number:</strong> ${data.answerSheet.set_number}</p>
          <p><strong>Copy Count:</strong> ${data.answerSheet.copy_count}</p>
          <p><strong>AI Score:</strong> ${
            data.answerSheet.ai_score !== undefined &&
            data.answerSheet.ai_score !== null
              ? data.answerSheet.ai_score
              : "N/A"
          }</p>
          <hr style="margin: 20px 0;">
          ${data.answerSheet.data
            .map((item, index) => {
              const question = Object.keys(item)[0];
              const answer = item[question];
              const questionNumber = index + 1;

              // Map AI evaluation - handle both 0-based and 1-based indexing
              // First try to find by question_number matching index+1
              let aiEval = data.answerSheet.ai_evaluations?.find(
                (evaluation) => evaluation.question_number === questionNumber
              );

              // If not found, use array index (in case question_number is wrong or 0-based)
              if (
                !aiEval &&
                data.answerSheet.ai_evaluations &&
                data.answerSheet.ai_evaluations[index]
              ) {
                aiEval = data.answerSheet.ai_evaluations[index];
              }

              return `
              <div class="question">
                <div class="question-title">Question ${questionNumber}</div>
                <p>${escapeHTML(question)}</p>
                <p><strong>Answer:</strong></p>
                <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f4f4f4; padding: 10px; border-radius: 5px;">${
                  escapeHTML(answer) || "No answer provided"
                }</pre>
              </div>
            `;
            })
            .join("")}
        </body>
      </html>
    `;
  };

  // Download PDF as file
  const downloadPDF = async (answerSheetId) => {
    try {
      setDownloadingSheets((prev) => ({ ...prev, [answerSheetId]: true }));

      const response = await fetch(
        Allapi.getAnswerSheetById.url(answerSheetId),
        {
          headers: {
            Authorization: localStorage.getItem("token"),
          },
          method: "GET",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }

      const data = await response.json();
      const printContent = generatePDFContent(data);

      // Create a blob and download it
      const blob = new Blob([printContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AnswerSheet_${data.answerSheet.student_name}_${data.answerSheet.set_number}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (error) {
      toast.error(error.message || "Failed to download PDF");
    } finally {
      setDownloadingSheets((prev) => ({ ...prev, [answerSheetId]: false }));
    }
  };

  // Print PDF
  const printPDF = async (answerSheetId) => {
    try {
      setDownloadingSheets((prev) => ({ ...prev, [answerSheetId]: true }));

      const response = await fetch(
        Allapi.getAnswerSheetById.url(answerSheetId),
        {
          headers: {
            Authorization: localStorage.getItem("token"),
          },
          method: "GET",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load PDF");
      }

      const data = await response.json();
      const printContent = generatePDFContent(data);

      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(printContent);
      iframe.contentWindow.document.close();

      iframe.onload = () => {
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
    } catch (error) {
      toast.error(error.message || "Failed to print PDF");
    } finally {
      setDownloadingSheets((prev) => ({ ...prev, [answerSheetId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute w-full h-full border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div
            className="absolute border-4 border-blue-300 rounded-full top-1 left-1 w-14 h-14 border-t-transparent animate-spin"
            style={{ animationDuration: "1.5s" }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">My Exams</h1>
          <div className="flex gap-4">
            <button
              onClick={() => {
                localStorage.clear();
                navigate("/login");
              }}
              className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-all duration-300"
            >
              Logout
            </button>
            <button
              onClick={() => navigate("/create-exam")}
              className="flex items-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-all duration-300"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Exam
            </button>
            {/* <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 transition-all duration-300"
            >
              <Mail className="w-5 h-5 mr-2" />
              Send Emails
            </button> */}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-white">
                    {exam.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-sm rounded-full bg-blue-500/20 text-blue-400 whitespace-nowrap">
                      {exam.exam_type === "coaviva" ? "15 Viva" : exam.exam_type}
                    </span>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      disabled={deletingExams[exam.id]}
                      className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all duration-300 disabled:opacity-50"
                      title="Delete Exam"
                    >
                      {deletingExams[exam.id] ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
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
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/edit-exam/${exam.id}`)}
                      className="flex-1 px-3 py-2 text-sm text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleStatusChange(
                          exam.id,
                          exam.status === "start" ? "stop" : "start"
                        )
                      }
                      disabled={loadingExamStatus[exam.id]}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all duration-300 ${
                        exam.status === "start"
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      }`}
                    >
                      {loadingExamStatus[exam.id] ? (
                        <div className="flex items-center justify-center">
                          <Loader className="w-4 h-4 animate-spin" />
                        </div>
                      ) : exam.status === "start" ? (
                        "Stop"
                      ) : (
                        "Start"
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchAnswerSheets(exam.id)}
                      className="flex-1 px-3 py-2 text-sm text-purple-400 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                    >
                      View Answer Sheets
                    </button>
                    <button
                      onClick={() => fetchQuestionSets(exam.id)}
                      className="flex-1 px-3 py-2 text-sm text-yellow-400 bg-yellow-500/20 rounded-lg hover:bg-yellow-500/30 transition-all duration-300"
                    >
                      View Sets
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showAnswerSheets && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            style={{ scrollbarWidth: "none" }}
          >
            <div
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Submitted Answer Sheets
                </h2>
                <button
                  onClick={() => {
                    setShowAnswerSheets(false);
                    setSelectedExam(null);
                    setAnswerSheets([]);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {loadingAnswerSheets ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : answerSheets.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-4 justify-end mb-4">
                    <button
                      onClick={downloadAllPDF}
                      disabled={downloadingAll}
                      className="flex items-center px-4 py-2 text-green-400 bg-green-500/20 rounded-lg hover:bg-green-500/30 transition-all duration-300"
                    >
                      {downloadingAll ? (
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Download All
                    </button>
                  </div>
                  {answerSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                    >
                      <div>
                        <h3 className="text-white font-medium">
                          {sheet.student_name}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {sheet.student_email}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Set: {sheet.set_number}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadPDF(sheet.id)}
                          disabled={downloadingSheets[sheet.id]}
                          className="flex items-center px-3 py-2 text-sm text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
                        >
                          {downloadingSheets[sheet.id] ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <span className="flex items-center">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => printPDF(sheet.id)}
                          disabled={downloadingSheets[sheet.id]}
                          className="flex items-center px-3 py-2 text-sm text-purple-400 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                        >
                          {downloadingSheets[sheet.id] ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <span className="flex items-center">
                              <Printer className="w-4 h-4 mr-2" />
                              Print
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400">
                  No submitted answer sheets found
                </p>
              )}
            </div>
          </div>
        )}

        {showQuestionSets && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            style={{ scrollbarWidth: "none" }}
          >
            <div
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Question Sets</h2>
                <button
                  onClick={() => {
                    setShowQuestionSets(false);
                    setSelectedExam(null);
                    setQuestionSets([]);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {loadingQuestionSets ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : questionSets.length > 0 ? (
                <div className="space-y-6">
                  {questionSets.map((set) => (
                    <div key={set.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-white">
                          Set {set.set_number} / {questionSets.length}
                        </h3>
                        <span className="px-2 py-1 text-sm rounded-full bg-blue-500/20 text-blue-400">
                          {set.exam_type === "coaviva"
                            ? "15 Viva"
                            : set.exam_type}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {set.questions.map((question, index) => (
                          <div key={index} className="bg-gray-800 rounded p-3">
                            <p className="text-gray-300">
                              <span className="text-blue-400 mr-2">
                                {index + 1}.
                              </span>
                              {question}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400">
                  No question sets found
                </p>
              )}
            </div>
          </div>
        )}

        {/* Send Emails Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Send Emails</h2>
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setSelectedClass("");
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Class
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Choose a class to send exam invitation emails to all
                    students in that class
                  </p>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select a Class --</option>
                    {availableClasses.map((className) => (
                      <option key={className} value={className}>
                        {className.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClass && studentsData[selectedClass] && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-300 mb-2">
                      Will send emails to{" "}
                      {studentsData[selectedClass].length - 1} student(s) in{" "}
                      {selectedClass.toUpperCase()}
                      <span className="text-gray-500 text-xs ml-2">
                        (First entry ignored as admin)
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowEmailModal(false);
                      setSelectedClass("");
                    }}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendBulkEmails}
                    disabled={sendingBulkEmails || !selectedClass}
                    className="flex items-center px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    {sendingBulkEmails ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Emails
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherPanel;
