type DBValue = any;

class RunTimeDatabase {
	private static instance: RunTimeDatabase;
	private store: Map<string, DBValue>;

	private constructor() {
		this.store = new Map();
	}

	public static getInstance(): RunTimeDatabase {
		if (!RunTimeDatabase.instance) {
			RunTimeDatabase.instance = new RunTimeDatabase();
		}
		return RunTimeDatabase.instance;
	}

	public set(key: string, value: DBValue): void {
		this.store.set(key, value);
	}

	public get<T = DBValue>(key: string): T | undefined {
		return this.store.get(key);
	}

	public has(key: string): boolean {
		return this.store.has(key);
	}

	public delete(key: string): boolean {
		return this.store.delete(key);
	}

	public clear(): void {
		this.store.clear();
	}

	public keys(): string[] {
		return Array.from(this.store.keys());
	}

	public values(): DBValue[] {
		return Array.from(this.store.values());
	}
}

export default RunTimeDatabase;