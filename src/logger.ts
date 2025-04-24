export function info(message: string, data?: any) {
  console.log(`[INFO] ${message}`, data || '');
}

export function error(message: string, data?: any) {
  console.error(`[ERROR] ${message}`, data || '');
}
