/**
 * List of allowed teacher/admin emails
 */
export const allowedTeacherEmails = [
  "maheshkarri2109@gmail.com",
  "maheshkarri2222@gmail.com",
  "vasu.challapalli9@gmail.com",
  "yasvanthhanumantu1@gmail.com",
  "vasuch9491@gmail.com",
  "ramavathmallikarjunanaik332@gmail.com",
  "vasuch9959@gmail.com"
];

/**
 * Validates if the given email is in the teacher whitelist
 * @param {string} email - The email to validate
 * @returns {boolean} - True if the email is allowed
 */
export const validateTeacherAccess = (email) => {
  if (!email) return false;
  return allowedTeacherEmails.includes(email.toLowerCase());
};
