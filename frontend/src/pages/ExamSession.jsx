import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { RefreshCw, Brain, ArrowLeft } from "lucide-react";
import Allapi from "../utils/common";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { TypeAnimation } from "react-type-animation";

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
const ExamSession = () => {
  const { id: answerSheetId } = useParams();
  const navigate = useNavigate();
  const [answerSheet, setAnswerSheet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [copied, setCopied] = useState(false);
  const [localCopyCount, setLocalCopyCount] = useState(0); // Local counter for cheating detection
  const lastViolationTimeRef = useRef(0); // Prevent rapid duplicate triggers
  const [passcode, setPasscode] = useState("");
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshCode, setRefreshCode] = useState("");
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [aiEvaluating, setAiEvaluating] = useState(false);
  const [aiScore, setAiScore] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [aiAnswerStatus, setAiAnswerStatus] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const answerSheetResponse = await fetch(
          Allapi.getAnswerSheetById.url(answerSheetId),
          {
            headers: {
              Authorization: localStorage.getItem("token"),
            },
          }
        );

        if (!answerSheetResponse.ok)
          throw new Error("Failed to fetch answer sheet");
        const answerSheetData = await answerSheetResponse.json();
        setAnswerSheet(answerSheetData.answerSheet);

        if (answerSheetData.answerSheet.data) {
          const initialAnswers = {};
          answerSheetData.answerSheet.data.forEach((answer) => {
            const question = Object.keys(answer)[0];
            initialAnswers[question] = answer[question];
          });
          setAnswers(initialAnswers);
        }

        setCopied(answerSheetData.answerSheet.copied || false);
        setLocalCopyCount(answerSheetData.answerSheet.copy_count || 0);

        if (answerSheetData.answerSheet.duration) {
          const startTime = new Date(
            answerSheetData.answerSheet.created_at.$date ||
              answerSheetData.answerSheet.created_at
          ).getTime();

          const res = await fetch(Allapi.getTime.url, {
            method: "GET",
          });
          const data = await res.json();
          const currentTime = new Date(data.timestamp).getTime();
          console.log("IST time current time:", currentTime);
          const currentTime2 = new Date().getTime();
          console.log("current time 2", currentTime2);
          const elapsedTime = Math.floor((currentTime - startTime) / 1000);
          const remainingTime = Math.max(
            0,
            answerSheetData.answerSheet.duration * 60 - elapsedTime
          );
          setTimeLeft(remainingTime);
        }

        setLoading(false);
      } catch (error) {
        toast.error("Failed to load exam data");
        console.error("Error loading exam:", error);
        navigate("/student");
      }
    };

    fetchData();
  }, [answerSheetId, navigate]);

  const handleRefreshQuestions = async () => {
    if (refreshCode !== "logic404") {
      toast.error("Invalid refresh code");
      return;
    }

    try {
      setRefreshLoading(true);
      const response = await fetch(
        Allapi.refreshAnswerSheet.url(answerSheetId),
        {
          method: "PUT",
          headers: {
            Authorization: localStorage.getItem("token"),
          },
        }
      );

      if (!response.ok) throw new Error("Failed to refresh answer sheet");

      const refreshedData = await response.json();
      setAnswerSheet(refreshedData.answerSheet);
      setAnswers({});
      setShowRefreshModal(false);
      setRefreshCode("");
      toast.success("Questions refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh questions");
    } finally {
      setRefreshLoading(false);
    }
  };

  const evaluateAnswers = useCallback(async () => {
    setAiEvaluating(true);
    let finalAiScore = null;
    const statuses = [];

    try {
      // Evaluate each answer individually ()
      for (let i = 0; i < answerSheet.data.length; i++) {
        const question = Object.keys(answerSheet.data[i])[0];
        const answer = answers[question] || "";

        // Check if question is about code execution (contains code-related keywords)
        const isCodeQuestion =
          /function|code|program|syntax|execute|run|console|log|var|let|const|if|else|for|while|return/i.test(
            question
          ) ||
          /function|code|program|syntax|execute|run|console|log|var|let|const|if|else|for|while|return/i.test(
            answer
          );

        let prompt;
        if (isCodeQuestion) {
          // For code questions, get detailed analysis with explanation
          prompt = `Analyze the following code in relation to the question. Provide a detailed evaluation in the following format:

STATUS: [will execute OR will not execute]
OVERVIEW: [Brief 1-2 sentence overview of the code]
EXPLANATION: [Detailed explanation of why it will or will not execute, including syntax errors, logic issues, or correctness]

Question: ${question}
Answer (code): ${answer}

Provide your response in the exact format above.`;
        } else {
          // For conceptual questions, get detailed evaluation
          prompt = `Evaluate the following answer for the given question. Provide a detailed evaluation in the following format:

STATUS: [will execute (correct/complete) OR will not execute (incorrect/incomplete)]
OVERVIEW: [Brief 1-2 sentence overview of the answer quality]
EXPLANATION: [Detailed explanation of what is correct, what is missing, what is incorrect, and why]

Question: ${question}
Answer: ${answer}

Provide your response in the exact format above.`;
        }

        const statusResponse = await fetch(Allapi.aiScore.url, {
          method: "POST",
          headers: {
            Authorization: localStorage.getItem("token"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const fullResponse = statusData.response?.trim() || "";

          // Parse the detailed response
          let status = "will not execute";
          let overview = "";
          let explanation = "";

          // Extract STATUS
          const statusMatch = fullResponse.match(
            /STATUS:\s*(will execute|will not execute)/i
          );
          if (statusMatch) {
            status = statusMatch[1].toLowerCase();
          }

          // Extract OVERVIEW
          const overviewMatch = fullResponse.match(
            /OVERVIEW:\s*([^\n]+(?:\n(?!EXPLANATION:)[^\n]+)*)/i
          );
          if (overviewMatch) {
            overview = overviewMatch[1].trim();
          }

          // Extract EXPLANATION
          const explanationMatch = fullResponse.match(
            /EXPLANATION:\s*([\s\S]+)/i
          );
          if (explanationMatch) {
            explanation = explanationMatch[1].trim();
          }

          // If parsing failed, try to extract status from response
          if (!statusMatch) {
            const lowerResponse = fullResponse.toLowerCase();
            if (lowerResponse.includes("will execute")) {
              status = "will execute";
            } else if (lowerResponse.includes("will not execute")) {
              status = "will not execute";
            }
            // Use full response as explanation if structured format not found
            if (!explanation) {
              explanation = fullResponse;
            }
          }

          statuses.push({
            questionNumber: i + 1,
            status: status,
            overview: overview || "No overview provided",
            explanation: explanation || "No explanation provided",
          });
        } else {
          // If API call fails, default to "will not execute"
          console.error(`AI evaluation failed for question ${i + 1}`);
          statuses.push({
            questionNumber: i + 1,
            status: "will not execute",
            overview: "Evaluation failed",
            explanation: "Unable to evaluate this answer due to an error.",
          });
        }
      }

      // Calculate final score
      const questions = answerSheet.data.map((item) => Object.keys(item)[0]);

      const scoreResponse = await fetch(Allapi.aiScore.url, {
        method: "POST",
        headers: {
          Authorization: localStorage.getItem("token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `Based on these answers for the questions in this data ${questions}, provide a single numerical score out of 100. Only return the number: ${JSON.stringify(
            answers
          )}`,
        }),
      });

      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        const scoreText = scoreData.response?.trim() || "";

        // Extract number from response (handle cases where AI returns text with number)
        const scoreMatch = scoreText.match(/\d+(\.\d+)?/);
        if (scoreMatch) {
          finalAiScore = parseFloat(scoreMatch[0]);
          // Ensure score is between 0 and 100
          if (finalAiScore > 100) finalAiScore = 100;
          if (finalAiScore < 0) finalAiScore = 0;
        } else {
          console.warn("Could not extract score from AI response:", scoreText);
          finalAiScore = 0;
        }
      } else {
        console.error("Failed to get AI score");
        finalAiScore = 0;
      }

      setAiAnswerStatus(statuses);
      setAiScore(finalAiScore);
      setShowResults(true);
      return { score: finalAiScore, evaluations: statuses };
    } catch (error) {
      console.error("AI evaluation failed:", error);
      return null;
    } finally {
      setAiEvaluating(false);
    }
  }, [answerSheet, answers]);

  const handleSubmit = useCallback(async () => {
    // Allow submission even if exam status is "stop" - students can submit after teacher stops exam
    try {
      let aiScore = null;

      let aiEvaluations = [];
      if (
        answerSheet?.exam_type === "external" ||
        answerSheet?.exam_type === "viva" ||
        answerSheet?.exam_type === "coaviva"
      ) {
        const evaluationResult = await evaluateAnswers();
        if (evaluationResult) {
          aiScore = evaluationResult.score;
          aiEvaluations = evaluationResult.evaluations;
        }
      }

      const formattedAnswers = answerSheet.data.map((questionObj) => {
        const question = Object.keys(questionObj)[0];
        return {
          [question]: answers[question]
            ? answers[question].replace(/\r\n/g, "\n")
            : "",
        };
      });

      setLoading(true);
      const response = await fetch(Allapi.submitAnswerSheet.url, {
        method: "PUT",
        headers: {
          Authorization: localStorage.getItem("token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer_sheet_id: answerSheetId,
          answers: formattedAnswers,
          ai_score: aiScore,
          ai_evaluations: aiEvaluations,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit answer sheet");

      toast.success("Exam submitted successfully");
      setLoading(false);
      setAnswerSheet((prevState) => ({
        ...prevState,
        submit_status: true,
      }));

      if (
        answerSheet?.exam_type === "viva" ||
        answerSheet?.exam_type === "external" ||
        answerSheet?.exam_type === "coaviva"
      ) {
        setShowResults(true);
      } else {
        navigate("/student");
      }
    } catch (error) {
      toast.error(error.message || "Failed to submit exam");
      setLoading(false);
    }
  }, [answerSheet, answers, answerSheetId, evaluateAnswers, navigate]);

  const markAsCopied = useCallback(() => {
    // Prevent if exam is already submitted
    if (answerSheet?.submit_status) return;

    // Prevent rapid duplicate triggers (debounce - 2 seconds)
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 2000) {
      return; // Ignore if triggered within 2 seconds of last violation
    }
    lastViolationTimeRef.current = now;

    // Use local counter for immediate response
    setLocalCopyCount((prev) => {
      const newCopyCount = prev + 1;

      // Open modal immediately - don't wait for API
      setCopied(true);
      setShowPasscodeModal(true);

      // Show warning based on local counter
      if (newCopyCount >= 4) {
        toast.error("Maximum copy attempts reached. Submitting exam...");
        handleSubmit();
      } else {
        toast.error(
          `Warning: ${
            4 - newCopyCount
          } chances remaining before automatic submission!`
        );
      }

      // Send API request in background (fire and forget)
      // Don't wait for response - modal is already open
      fetch(Allapi.assignCopied.url(answerSheetId), {
        method: "PUT",
        headers: {
          Authorization: localStorage.getItem("token"),
        },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error("Failed to mark as copied");
        })
        .then((data) => {
          // Update answer sheet with server response if successful
          setAnswerSheet((prevSheet) => ({
            ...prevSheet,
            copy_count: data.answerSheet?.copy_count || newCopyCount,
          }));
        })
        .catch((error) => {
          // Silently handle error - modal is already open, detection continues
          console.error("Error marking as copied (background):", error);
        });

      return newCopyCount;
    });
  }, [answerSheet, answerSheetId, handleSubmit]);

  // Move useEffect hooks that depend on markAsCopied and handleSubmit here
  useEffect(() => {
    if (timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, handleSubmit]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Keep detection active even if copied is true - only check if exam is submitted
      if (document.hidden && !answerSheet?.submit_status) {
        markAsCopied();
      }
    };

    const handleBlur = () => {
      // Detect when window loses focus (Alt+Tab, clicking away, etc.)
      if (!answerSheet?.submit_status) {
        // Small delay to avoid false positives from legitimate clicks within the page
        setTimeout(() => {
          if (!document.hasFocus() && !answerSheet?.submit_status) {
            markAsCopied();
          }
        }, 150);
      }
    };

    const handleFocus = () => {
      // When window regains focus, we can track this for analytics
      // The blur event already handles the detection
    };

    const handleResize = () => {
      // Keep detection active even if copied is true
      if (!answerSheet?.submit_status) {
        markAsCopied();
      }
    };

    const handleBeforeUnload = (e) => {
      // Block page reload until exam is submitted (regardless of exam status - start/stop)
      // Students can submit even after teacher stops the exam, but cannot reload until submitted
      if (!answerSheet?.submit_status) {
        e.preventDefault();
        markAsCopied();
        e.returnValue =
          "You cannot reload the page until you submit the exam. Your progress will be lost.";
      }
    };

    const handleKeyDown = (e) => {
      // Keep detection active even if copied is true
      if (answerSheet?.submit_status) return;

      // Detect copy/paste shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "v" || e.key === "x" || e.key === "a")
      ) {
        markAsCopied();
        return;
      }

      // Detect tab/window switching shortcuts
      // Ctrl+Tab, Ctrl+Shift+Tab (browser tab switching)
      if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
        markAsCopied();
        return;
      }

      // Ctrl+Shift+Tab (previous tab in browser)
      if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        markAsCopied();
        return;
      }

      // Alt+Tab, Alt+Shift+Tab (OS window switching)
      if (e.altKey && e.key === "Tab") {
        markAsCopied();
        return;
      }

      // Win+Tab (Windows task view) - Windows key + Tab
      // On Windows, this is usually detected via blur/visibilitychange, but we catch it here too
      if (e.metaKey && e.key === "Tab") {
        markAsCopied();
        return;
      }

      // Ctrl+Shift+N (incognito/private window)
      if (e.ctrlKey && e.shiftKey && (e.key === "n" || e.key === "N")) {
        markAsCopied();
        return;
      }

      // Ctrl+Shift+P (private window in Firefox)
      if (e.ctrlKey && e.shiftKey && (e.key === "p" || e.key === "P")) {
        markAsCopied();
        return;
      }

      // PageUp/PageDown with Ctrl (sometimes used for tab switching)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "PageUp" || e.key === "PageDown")
      ) {
        markAsCopied();
        return;
      }

      // Detect new tab, close tab shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "t" || e.key === "w" || e.key === "n" || e.key === "T")
      ) {
        markAsCopied();
        return;
      }

      // Detect refresh shortcuts
      if (
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && e.key === "r") ||
        ((e.ctrlKey || e.metaKey) && e.key === "R")
      ) {
        markAsCopied();
        return;
      }

      // Detect Alt+F4 (close window)
      if (e.altKey && e.key === "F4") {
        markAsCopied();
        return;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [answerSheet, markAsCopied]); // Include markAsCopied in dependencies

  const handleRemoveCopied = async () => {
    try {
      setCopyLoading(true);
      const response = await fetch(Allapi.removeCopied.url(answerSheetId), {
        method: "PUT",
        headers: {
          Authorization: localStorage.getItem("token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });
      setCopyLoading(false);
      if (!response.ok) throw new Error("Invalid passcode");

      // Reset local state - detection continues even after reset
      setCopied(false);
      setAnswers({});
      setShowPasscodeModal(false);
      setPasscode("");
      // Note: We don't reset localCopyCount - it continues tracking
      // The server will handle the actual reset
      toast.success("Copying status removed");
    } catch (error) {
      toast.error("Invalid passcode");
      // Detection continues even on error - modal stays open
    }
  };

  const formatEmail = (email) => {
    if (!email) return "";
    const [prefix, domain] = email.split("@");
    return `${prefix.toUpperCase()}@${domain}`;
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
          <h2 className="text-2xl font-bold text-white mb-4">
            AI is evaluating your answers...
          </h2>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-loading-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && answerSheet?.exam_type !== "internal") {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Exam Results
          </h2>

          <div className="mb-8">
            <div className="text-6xl font-bold text-blue-500 text-center mb-4">
              {aiScore}
            </div>
            <p className="text-xl text-gray-400 text-center">
              Your AI-Generated Score
            </p>
          </div>
          {answerSheet?.exam_type === "external" && (
            <div className="space-y-4 mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">
                Answer Status:
              </h3>
              {aiAnswerStatus.map((status, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-700 p-4 rounded-lg"
                >
                  <span className="text-white">
                    Question {status.questionNumber}
                  </span>
                  <span
                    className={
                      status.status === "will execute"
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {status.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate("/student")}
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
          <p className="text-gray-400 mb-6">
            Failed to load exam data. Please try again.
          </p>
          <button
            onClick={() => navigate("/student")}
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
          <h2 className="text-2xl font-bold text-white mb-4">
            Exam Already Submitted
          </h2>
          <p className="text-gray-400 mb-6">
            You have already submitted this exam.
          </p>
          <button
            onClick={() => navigate("/student")}
            className="px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (copied) {
    const remainingChances = 4 - localCopyCount;
    return (
      <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl border-2 border-red-500/20 p-8 text-center max-w-lg">
          <h2 className="text-2xl font-bold text-red-400 mb-4">
            Caught Cheating
          </h2>
          <p className="text-gray-400 mb-2">
            You have been marked for copying.
          </p>
          <p className="text-yellow-400 mb-6">
            {remainingChances} {remainingChances === 1 ? "chance" : "chances"}{" "}
            remaining before automatic submission
          </p>
          <div className="space-y-4">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              autoComplete="off"
              spellCheck="false"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              data-dashlane-ignore="true"
              data-bitwarden-watching="false"
              name="passcode-field"
              id="passcode-field"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleRemoveCopied}
              className="w-full px-6 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
            >
              {copyLoading ? "Submitting..." : "Submit Passcode"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract questions from answerSheet.data
  const questions = answerSheet.data
    ? answerSheet.data.map((answer) => Object.keys(answer)[0])
    : [];
  const currentQuestion = questions[activeQuestionIndex];

  if (answerSheet.exam_type === "external" && !examStarted) {
    return (
      <div
        className="min-h-screen bg-gray-900 p-8"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            {/* <button
              onClick={() => navigate('/student')}
              className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button> */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowRefreshModal(true)}
                className="flex items-center px-3 py-2 text-sm text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Questions
              </button>
              {timeLeft !== null && (
                <div
                  className={`text-lg font-mono ${
                    timeLeft < 300 ? "text-red-400" : "text-blue-400"
                  }`}
                >
                  Time Left: {formatTime(timeLeft)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-8">
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">
                  External Exam
                </h1>
                <p className="text-gray-400">Set {answerSheet.set_number}</p>
              </div>

              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div key={index} className="bg-gray-700 p-6 rounded-lg">
                    <h3 className="text-lg text-white mb-4">
                      Question {index + 1}
                    </h3>
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
              <h2 className="text-xl font-bold text-white mb-4">
                Refresh Questions
              </h2>
              <p className="text-gray-400 mb-4">
                Enter the refresh code to continue
              </p>
              <input
                type="password"
                value={refreshCode}
                onChange={(e) => setRefreshCode(e.target.value)}
                placeholder="Enter refresh code"
                autoComplete="off"
                spellCheck="false"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                data-dashlane-ignore="true"
                data-bitwarden-watching="false"
                name="refresh-code-field"
                id="refresh-code-field"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowRefreshModal(false);
                    setRefreshCode("");
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
                    "Refresh"
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
    <div
      className="min-h-screen bg-gray-900 p-8"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-gray-800 rounded-xl border-2 border-blue-500/20 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500/40">
                <img
                  src={`https://intranet.rguktn.ac.in/SMS/usrphotos/user/${capitalize(
                    user?.email?.split("@")[0]
                  )}.jpg`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src =
                      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXVzZXIiPjxwYXRoIGQ9Ik0xOSAyMXYtMmE0IDQgMCAwIDAtNC00SDlhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+";
                    e.target.className =
                      "w-full h-full object-contain p-2 text-gray-400";
                  }}
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {formatEmail(user?.email)}
                </h2>
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
              <div
                className={`text-lg font-mono ${
                  timeLeft < 300 ? "text-red-400" : "text-blue-400"
                }`}
              >
                Time Left: {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {answerSheet.exam_type === "external" ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {questions.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveQuestionIndex(index)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 ${
                      activeQuestionIndex === index
                        ? "bg-blue-500 text-white"
                        : answers[q]
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-white">
                  Question {activeQuestionIndex + 1}
                </h3>
                <p className="text-white">{currentQuestion}</p>
                {/* <textarea
                   value={answers[currentQuestion] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion]: e.target.value }))}
                   className="w-full h-64 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter your answer..."
                 />  */}
                <div
                  className="w-full h-64 border border-gray-600 rounded-lg overflow-hidden hide-scrollbar"
                  style={{ scrollbarWidth: "none" }}
                >
                  <CodeMirror
                    value={answers[currentQuestion] || ""}
                    height="100%"
                    theme={dracula}
                    extensions={[javascript()]}
                    onChange={(value) => {
                      setAnswers((prev) => ({
                        ...prev,
                        [currentQuestion]: value,
                      }));
                    }}
                    style={{ height: "100%", scrollbarWidth: "none" }}
                    className="hide-scrollbar"
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
                      autocompletion: false,
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
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() =>
                    setActiveQuestionIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={activeQuestionIndex === 0}
                  className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                    activeQuestionIndex === 0
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  Previous
                </button>
                {activeQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
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
                  <h3 className="text-lg text-white">
                    Question {index + 1}: {question}
                  </h3>
                  {answerSheet.exam_type === "internal" ? (
                    <p className="text-gray-400 italic">
                      This is an internal exam. No answers required.
                    </p>
                  ) : (
                    <textarea
                      value={answers[question] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question]: e.target.value,
                        }))
                      }
                      className="w-full h-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Enter your answer..."
                      style={{ scrollbarWidth: "none" }}
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
                  {loading ? "Submitting..." : "Submit Exam"}
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
            <h2 className="text-xl font-bold text-white mb-4">
              Refresh Questions
            </h2>
            <p className="text-gray-400 mb-4">
              Enter the refresh code to continue
            </p>
            <input
              type="password"
              value={refreshCode}
              onChange={(e) => setRefreshCode(e.target.value)}
              placeholder="Enter refresh code"
              autocomplete="new-password"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRefreshModal(false);
                  setRefreshCode("");
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
                  "Refresh"
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
