import {Loader as LoaderIcon} from 'lucide-react'

export default function Loader() {
    return (
        <div className='flex justify-center items-center'>
            <LoaderIcon className='animate-spin h-10 w-10 text-primary'/>
        </div>
    )
}

