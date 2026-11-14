export default function BrandLogo({ className = "" }) {
    return (
        <div
            className={`flex items-center justify-center overflow-hidden rounded-xl bg-white p-2 ${className}`}
        >
            <img
                src="/mohan-digital-labs-logo.png"
                alt="MOHAN Digital Lab's"
                className="h-full w-full object-contain"
            />
        </div>
    );
}
