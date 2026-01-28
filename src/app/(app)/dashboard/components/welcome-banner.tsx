import type { User } from "@/lib/data";

type WelcomeBannerProps = {
    user: User;
}

export default function WelcomeBanner({ user }: WelcomeBannerProps) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    }

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {getGreeting()}, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground mt-1">Here's what's happening on your campus today.</p>
        </div>
    );
}
