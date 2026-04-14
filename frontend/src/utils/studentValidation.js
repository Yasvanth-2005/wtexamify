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
 * Validates if a user email is allowed based on email domain
 * @param {string} email - User email
 * @param {string} className - Class name (optional, kept for backward compatibility but not used)
 * @returns {boolean} - True if email is from @rguktn.ac.in domain
 */
export const validateStudentAccess = (email) => {
  if (!email) return false;

  const lowerEmail = email.toLowerCase();
  
  // 1. Allow any email from @rguktn.ac.in domain
  if (!lowerEmail.endsWith("@rguktn.ac.in")) return false;

  // 2. Extract ID from email (e.g., "n210368")
  const idPrefix = lowerEmail.split("@")[0].toUpperCase();

  // 3. Check if this ID exists in any class in students_data.json
  // We flatten all classes into a single list of students
  const allStudents = Object.values(studentsData).flat();
  
  // 4. Return true if idPrefix matches any student's idNumber
  return allStudents.some(
    (student) => student.idNumber && student.idNumber.toUpperCase() === idPrefix
  );
};
