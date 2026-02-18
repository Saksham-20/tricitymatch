export function validateEmail(email: string): boolean;
export function validatePhone(phone: string): boolean;
export function validatePassword(password: string): boolean;
export function getPasswordErrors(password: string): string[];
export function getPasswordStrength(password: string): number;
export function validateName(name: string): boolean;
export function validateAge(dateOfBirth: string, minAge?: number, maxAge?: number): boolean;

