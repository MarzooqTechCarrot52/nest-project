export class CreateBookDto{
    title: string
    author : string
    price : number  
}

export class UpdateBookDto{
    title?:string
    author?:string
    price?: number
}