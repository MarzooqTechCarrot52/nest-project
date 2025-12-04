export class CreateBookDto{
    title: string
    author : string
    year : number  
}

export class UpdateBookDto{
    title?:string
    author?:string
    year?: number
}