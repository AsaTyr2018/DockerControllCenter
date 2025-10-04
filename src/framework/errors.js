export class AppValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AppValidationError';
    this.details = details;
  }
}

export class InstallationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InstallationError';
    this.details = details;
  }
}
