// maps postgresql error codes to http status codes and human-readable messages
// used by the global error handler in middleware/errorHandler.js
// javascript object keys are always strings internally — when you write 22001: as a key, javascript stores it as the string '22001' automatically
// 22P02 and 42P01 must have quotes because they contain letters and can't be valid unquoted identifiers
const pgErrorMap = {
  // string too long — value exceeds the column's character limit
  // example: username longer than varchar(30)
  22001: {
    status: 400,
    message: "A value exceeded the maximum allowed length.",
  },
  // invalid text representation — wrong data type for the column
  // example: passing a string where an integer is expected
  "22P02": {
    status: 400,
    message: "Invalid data format.",
  },
  // not null violation — a required column received no value
  // example: submitting a form without a required field
  23502: {
    status: 400,
    message: "A required field was missing.",
  },
  // foreign key violation — referencing a row that doesn't exist
  // example: assigning a project to a category that has been deleted
  23503: {
    status: 400,
    message: "Referenced resource does not exist.",
  },
  // unique constraint violation — duplicate value in a column with a UNIQUE constraint
  // example: registering with a username or email that already exists
  23505: {
    status: 409,
    message: "That value already exists.",
  },
  // undefined table — querying a table that does not exist
  // catches running the app before running the schema
  "42P01": {
    status: 500,
    message: "A required database table was not found.",
  },
};

// accepts a postgresql error object and returns the matching http status and message
// the full error object is passed (not just error.code) to allow future inspection
// of error.detail or error.constraint if needed without changing call sites
// falls back to 500 for any unmapped error code
// called by global error handler to translate database errors into clean http responses
export const getPgError = (error) => {
  return (
    pgErrorMap[error.code] ?? {
      status: 500,
      message: "An unexpected database error occurred.",
    }
  );
};

export default pgErrorMap;
