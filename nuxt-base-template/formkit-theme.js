export default {
    global: {
        fieldset: 'max-w-md border border-gray-400 rounded px-2 pb-1',
        help: 'text-xs text-gray-500 mt-1',
        inner: 'formkit-disabled:bg-gray-200 formkit-disabled:dark:bg-gray-200 formkit-disabled:cursor-not-allowed formkit-disabled:pointer-events-none rounded-[25px] bg-white formkit-invalid:ring-red',
        input: 'appearance-none bg-transparent focus:outline-none focus:ring-0 focus:shadow-none dark:text-white',
        label: 'block mb-1 text-sm text-gray-600 dark:text-white font-semibold text-left',
        legend: 'font-bold text-sm',
        loaderIcon: 'inline-flex items-center w-4 text-gray-600 animate-spin',
        message: 'text-red-500 mb-1 text-xs',
        messages: 'list-none p-0 mt-1 mb-0 text-left',
        outer: 'mb-4 formkit-disabled:opacity-50',
        prefixIcon: 'w-10 flex self-stretch grow-0 shrink-0 rounded-tl rounded-bl border-r border-gray-400 bg-white bg-gradient-to-b from-transparent to-gray-200 [&>svg]:w-full [&>svg]:max-w-[1em] [&>svg]:max-h-[1em] [&>svg]:m-auto',
        suffixIcon: 'w-7 pr-3 flex self-stretch grow-0 shrink-0 [&>svg]:w-full [&>svg]:max-w-[1em] [&>svg]:max-h-[1em] [&>svg]:m-auto'
    },
    // Family styles apply to all inputs that share a common family
    'family:box': {
        decorator: 'block relative h-3 w-3 mr-2 rounded-full bg-white ring-1 ring-gray-600 formkit-invalid:ring-red peer-checked:ring-primary-500 text-transparent peer-checked:bg-primary-500',
        decoratorIcon: 'flex p-[3px] w-full h-full absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2',
        help: 'mb-2 mt-1.5',
        input: 'absolute w-0 h-0 overflow-hidden opacity-0 pointer-events-none peer',
        label: '$reset text-sm text-gray-700 mt-1 select-none ps-1',
        wrapper: 'flex items-start mb-1',
        inner: '!bg-transparent mt-2 mx-auto',
    },
    'family:button': {
        inner: 'bg-none',
        input: '$reset inline-flex items-center justify-center bg-primary-400 hover:bg-primary-500 transition-all duration-200 text-white dark:text-gray-100 text-base font-semibold py-2 px-6 rounded-[25px] focus-visible:outline-2 focus-visible:outline-primary-600 focus-visible:outline-offset-2 formkit-disabled:bg-gray-400 formkit-loading:before:w-4 formkit-loading:before:h-4 formkit-loading:before:mr-2 formkit-loading:before:border formkit-loading:before:border-2 formkit-loading:before:border-r-transparent formkit-loading:before:rounded-[25px] formkit-loading:before:border-white formkit-loading:before:animate-spin min-w-[200px] py-2 px-3 text-base',
        wrapper: 'mb-1',
        prefixIcon: '$reset block w-4 -ml-2 mr-2 stretch',
        suffixIcon: '$reset block w-4 ml-2 stretch',
    },
    'family:dropdown': {
        dropdownWrapper: 'my-2 w-full drop-shadow-lg rounded [&::-webkit-scrollbar]:hidden',
        emptyMessageInner: 'flex items-center justify-center text-sm p-2 text-center w-full text-gray-500 [&>span]:mr-3 [&>span]:ml-0',
        inner: 'max-w-md relative flex ring-1 formkit-invalid:ring-red ring-gray-400 focus-within:ring-primary-500 focus-within:ring-2 rounded mb-1 formkit-disabled:focus-within:ring-gray-400 formkit-disabled:focus-within:ring-1 [&>span:first-child]:focus-within:text-primary-500',
        input: 'w-full px-3 py-2',
        listbox: 'bg-white drop-shadow-lg rounded overflow-hidden',
        listboxButton: 'flex w-12 self-stretch justify-center mx-auto',
        listitem: 'pl-7 relative hover:bg-gray-300 data-[is-active="true"]:bg-gray-300 data-[is-active="true"]:aria-selected:bg-primary-600 aria-selected:bg-primary-600 aria-selected:text-white',
        loaderIcon: 'ml-auto',
        loadMoreInner: 'flex items-center justify-center text-sm p-2 text-center w-full text-primary-500 formkit-loading:text-gray-500 cursor-pointer [&>span]:mr-3 [&>span]:ml-0',
        option: 'p-2.5',
        optionLoading: 'text-gray-500',
        placeholder: 'p-2.5 text-gray-300',
        selector: 'flex w-full justify-between items-center [&u]',
        selectedIcon: 'block absolute top-1/2 left-2 w-3 -translate-y-1/2',
        selectIcon: 'flex box-content w-4 px-2 self-stretch grow-0 shrink-0 dark:text-white',
    },
    'family:text': {
        inner: 'flex items-center ring-1 ring-gray-400 formkit-invalid:ring-red focus-within:ring-primary-400 focus-within:ring-2 [&>label:first-child]:focus-within:text-primary-500 rounded mb-1',
        input: 'w-full px-3 py-2 border-none text-base text-gray-700 placeholder-gray-400',
    },
    tags: {
        tag: 'bg-primary text-white rounded-full px-3 flex items-center',
        tagIcon: 'ms-2 text-lg cursor-pointer',
        dropdown: 'bg-white ring-2 ring-primary-400 rounded-b-[25px] overflow-hidden',
        dropdownItem: 'text-base font-normal py-2 px-3 hover:bg-gray-100 hover:text-primary w-full text-start dark:bg-gray-100 dark:text-white dark:hover:text-primary',
        noItemsFound: 'text-base font-normal py-2 px-3 w-full text-start',
        inputWrapper: 'formkit-disabled:bg-gray-200 formkit-disabled:cursor-not-allowed formkit-disabled:pointer-events-none rounded-[25px] bg-white flex items-center ring-1 ring-gray-400 formkit-invalid:ring-red focus-within:ring-primary-400 focus-within:ring-2 [&>label:first-child]:focus-within:text-primary-500 focus-within:rounded-b-none mt-2 transition-all duration-200',
        input: 'w-full px-3 py-2 border-none text-base text-gray-700 placeholder-gray-400',
        selectIcon: 'dark:text-white'
    },
    freeTags: {
        tag: 'border border-primary formkit-invalid:border-red rounded-full px-3 flex items-center text-gray-600',
        tagIcon: 'ms-2 text-lg cursor-pointer text-gray-600',
        inputWrapper: 'formkit-disabled:bg-gray-200 formkit-disabled:cursor-not-allowed formkit-disabled:pointer-events-none rounded-[25px] bg-white flex items-center ring-1 ring-gray-400 formkit-invalid:ring-red focus-within:ring-primary-400 focus-within:ring-2 [&>label:first-child]:focus-within:text-primary-500 mt-2 transition-all duration-200',
        input: 'w-full px-3 py-2 border-none text-base text-gray-700 placeholder-gray-400',
        inputIcon: 'i-bi-plus me-2 text-lg text-gray-600',
        button: 'bg-primary-500 hover:bg-primary-400 text-primary-50 min-w-[200px] py-2 px-3 text-base rounded-full mt-3 disabled:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400',
        suggestionsHeadline: 'text-sm text-gray-600 font-semibold mt-5 mb-3',
        suggestionsTag: 'border border-primary rounded-full px-3 flex items-center text-gray-600',
        suggestionsIcon: 'i-bi-plus text-lg text-gray-600 ms-2 cursor-pointer',
        selectIcon: 'dark:text-white'
    },
    image: {
        placeholder: 'dark:text-white',
        inner: 'block shadow-none w-full',
        uploader: 'relative p-4 text-center w-full h-full flex items-center justify-center',
        input: 'absolute top-0 left-0 right-0 bottom-0 opacity-0 cursor-pointer',
        fileList: 'p-0',
        fileItem: 'rounded-[20px] flex items-center h-full',
        fileItemImage: 'w-28 h-full rounded-[20px] object-cover object-center me-4',
        fileItemImageName: 'me-4 dark:text-white',
        fileItemRemove: 'appearance-none bg-none border-none font-bold shadow-none ms-auto cursor-pointer me-4 hover:text-red-500',
        container: 'h-36 border border-dashed formkit-invalid:border-red border-gray-200 rounded-[20px]',
    },
    // Specific styles apply only to a given input type
    color: {
        inner: 'flex max-w-[5.5em] w-full formkit-prefix-icon:max-w-[7.5em] formkit-suffix-icon:formkit-prefix-icon:max-w-[10em]',
        input: '$reset appearance-none w-full cursor-pointer border-none rounded p-0 m-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none',
        suffixIcon: 'min-w-[2.5em] pr-0 pl-0 m-auto'
    },
    file: {
        fileItem: 'flex items-center text-gray-800 mb-1 last:mb-0',
        fileItemIcon: 'w-4 mr-2 shrink-0',
        fileList: 'shrink grow peer px-3 py-2 formkit-multiple:data-[has-multiple="true"]:mb-6',
        fileName: 'break-all grow text-ellipsis',
        fileRemove: 'relative z-[2] ml-auto text-[0px] hover:text-red-500 pl-2 peer-data-[has-multiple=true]:text-sm peer-data-[has-multiple=true]:text-primary-500 peer-data-[has-multiple=true]:ml-3 peer-data-[has-multiple=true]:mb-2 formkit-multiple:bottom-[0.15em] formkit-multiple:pl-0 formkit-multiple:ml-0 formkit-multiple:left-[1em] formkit-multiple:formkit-prefix-icon:left-[3.75em]',
        fileRemoveIcon: 'block text-base w-3 relative z-[2]',
        inner: 'relative cursor-pointer formkit-multiple:[&>button]:absolute',
        input: 'cursor-pointer text-transparent absolute top-0 right-0 left-0 bottom-0 opacity-0 z-[2]',
        noFiles: 'flex w-full items-center px-3 py-2 text-gray-400',
        noFilesIcon: 'w-4 mr-2'
    },
    radio: {
        decorator: '!w-3 !h-3 rounded-full ring-gray-300',
        decoratorIcon: 'w-3 !p-[2px]',
        fieldset: 'border-none !p-0 !m-0 max-w-none !mt-2',
        options: 'flex flex-row gap-5 w-full',
        option: '',
        icon: 'text-md i-bi-eye dark:text-white',
        legend: 'flex items-center',
        label: `text-gray-700 font-normal text-[15px] leading-[140%] !mt-1`,
        wrapper: '!mb-0',
        inner: '',
    },
    search: {
        suffixIcon: 'dark:text-gray-700'
    },
    range: {
        inner: '$reset flex items-center max-w-md',
        input: '$reset w-full mb-1 h-2 p-0 rounded-full',
        prefixIcon: '$reset w-4 mr-1 flex self-stretch grow-0 shrink-0 [&>svg]:max-w-[1em] [&>svg]:max-h-[1em] [&>svg]:m-auto',
        suffixIcon: '$reset w-4 ml-1 flex self-stretch grow-0 shrink-0 [&>svg]:max-w-[1em] [&>svg]:max-h-[1em] [&>svg]:m-auto'
    },
    select: {
        inner: 'flex relative items-center rounded mb-1 ring-1 ring-gray-400 formkit-invalid:ring-red focus-within:ring-primary-500 focus-within:ring-2 [&>span:first-child]:focus-within:text-primary-500',
        input: 'w-full pl-3 pr-8 py-2 border-none text-base text-gray-700 placeholder-gray-300 formkit-multiple:p-0 data-[placeholder="true"]:text-gray-400 formkit-multiple:data-[placeholder="true"]:text-inherit appearance-none bg-none',
        selectIcon: 'flex p-[3px] shrink-0 w-5 mr-2 -ml-[1.5em] h-full pointer-events-none dark:text-text-gray-700',
        option: 'formkit-multiple:p-3 formkit-multiple:text-sm text-gray-700'
    },
    textarea: {
        inner: 'flex rounded mb-1 ring-1 ring-gray-400 formkit-invalid:ring-red focus-within:ring-primary-400 [&>label:first-child]:focus-within:text-primary-500',
        input: 'block w-full h-32 px-3 py-3 border-none text-base text-gray-700 placeholder-gray-400 focus:shadow-outline',
    },
}