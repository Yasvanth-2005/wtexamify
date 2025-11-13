import studentsData from "./students_data.json";

/**
 * Extracts student ID from email (first 7 characters, uppercase)
 * @param {string} email - User email (e.g., "n210368@rguktn.ac.in")
 * @returns {string} - Student ID (e.g., "N210368")
 */
export const extractStudentId = (email) => {
  if (!email) return "";
  const prefix = email.split("@")[0];
  return prefix.substring(0, 7).toUpperCase();
};

/**
 * Checks if student ID exists in the specified class
 * @param {string} studentId - Student ID to check (e.g., "N210368")
 * @param {string} className - Class name (e.g., "cse4")
 * @returns {boolean} - True if student ID exists in the class
 */
export const isStudentAllowed = (studentId, className = "cse4") => {
  if (!studentId || !className) return false;

  const classData = studentsData[className];
  if (!classData || !Array.isArray(classData)) return false;

  return classData.some((student) => student.idNumber === studentId);
};

/**
 * Validates if a user email is allowed based on student ID check
 * @param {string} email - User email
 * @param {string} className - Class name (optional, if not provided checks cse5 and cse6)
 * @returns {boolean} - True if student is allowed
 */
export const validateStudentAccess = (email, className = null) => {
  if (!email) return false;

  // Extract student ID from email
  const studentId = extractStudentId(email);

  // If className is provided, check that specific class
  if (className) {
    return isStudentAllowed(studentId, className);
  }

  // Otherwise, check if student is in cse5 OR cse6
  return (
    isStudentAllowed(studentId, "cse5") || isStudentAllowed(studentId, "cse6")
  );
};
