export class Error {
    constructor(public status: number = 500, public message: string = 'Something wrong', public data?: any) {}
}

export class NotFoundError extends Error {
    constructor(public message: string = 'Not found!', public data?: any) {
        super(404, message, data);
    }
}