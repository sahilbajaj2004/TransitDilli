/**
 * TransitDilli Real-Time Native Application Logger
 * Logs messages directly to:
 * 1. Metro Bundler Terminal ("Logs for your project will appear below. Press Ctrl+C to exit.")
 * 2. React Native console (ADB logcat)
 * 3. In-App Live Activity Log Modal
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  tag: string;
  message: string;
}

type LogListener = (logs: LogEntry[]) => void;

class AppLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs: number = 100;

  private formatTime(): string {
    const d = new Date();
    return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  private addEntry(level: 'info' | 'warn' | 'error' | 'success', tag: string, message: string) {
    const time = this.formatTime();
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: time,
      level,
      tag,
      message,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // 1. Output to React Native console (forwarded directly to Metro CLI terminal!)
    const formatted = `[${time}] [${tag}] ${message}`;
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // 2. Notify in-app subscribers
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.logs]);
    }
  }

  public info(tag: string, message: string) {
    this.addEntry('info', tag, message);
  }

  public success(tag: string, message: string) {
    this.addEntry('success', tag, message);
  }

  public warn(tag: string, message: string) {
    this.addEntry('warn', tag, message);
  }

  public error(tag: string, message: string) {
    this.addEntry('error', tag, message);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => this.listeners.delete(listener);
  }
}

export const logger = new AppLogger();
