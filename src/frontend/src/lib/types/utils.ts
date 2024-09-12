export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>;

export type ResultSuccess<T = unknown> = { success: boolean; err?: T };

export type ResultSuccessReduced<T = unknown> = ResultSuccess<T[]>;

export type Option<T> = T | null | undefined;
