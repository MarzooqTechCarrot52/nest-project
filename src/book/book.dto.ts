export class CreateBookDto{
    title: string
    author : string
    price : number 
    name?:string
    category?:string
    quantity?:number
}

export class UpdateBookDto{
    title?:string
    author?:string
    price?: number
}