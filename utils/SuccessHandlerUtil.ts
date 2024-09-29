export class Success {
    constructor(public data: any, public message: string = 'Success', public status: number = 200) {}
}

export class SuccessfullyCreated extends Success {
    constructor(public data: any, public message: string = 'Successfully Created') {
        super(data, message, 201);
    }
} 