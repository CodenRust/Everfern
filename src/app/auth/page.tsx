"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, Variants } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import WindowControls from "../components/WindowControls";

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.15,
        },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", bounce: 0.2, duration: 0.6 },
    },
};

export default function AuthPage() {
    const router = useRouter();
    const [isGuestLoading, setIsGuestLoading] = useState(false);

    const handleGuestLogin = () => {
        setIsGuestLoading(true);
        // Simulate a tiny delay for premium feel
        setTimeout(() => {
            router.push("/setup");
        }, 600);
    };

    return (
        <div className="flex min-h-screen bg-[#f5f4f0]" style={{ fontFamily: "var(--font-sans)" }}>
            {/* Window Controls - Top Right */}
            <div style={{ position: "fixed", top: 16, right: 20, zIndex: 100 }}>
                <WindowControls />
            </div>

            {/* Main Form Pane */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-8 bg-[#f5f4f0]">

                {/* Back Button */}
                <button
                    onClick={() => router.push("/")}
                    className="absolute top-12 left-8 flex items-center gap-2 text-[#8a8886] hover:text-[#4a4846] transition-colors text-sm font-medium z-50 focus:outline-none"
                >
                    <ChevronLeft size={16} /> Back
                </button>
                {/* Logo Area */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0.15, duration: 0.6, delay: 0.05 }}
                    className="absolute top-12 flex items-center gap-2"
                >
                    <Image
                        src="/images/logos/black-logo-withoutbg.png"
                        alt="EverFern"
                        width={28}
                        height={28}
                        className="opacity-90"
                    />
                    <span className="text-[22px] font-normal text-[#201e24] tracking-[-0.04em]" style={{ fontFamily: "var(--font-branding)" }}>
                        everfern
                    </span>
                    <span style={{
                        padding: "4px 10px",
                        backgroundColor: "rgba(32, 30, 36, 0.08)",
                        border: "1px solid rgba(32, 30, 36, 0.1)",
                        borderRadius: "6px",
                        fontSize: "9px",
                        fontWeight: 600,
                        color: "#8a8886",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginLeft: 6,
                    }}>
                        Desktop
                    </span>
                </motion.div>

                {/* Main Content */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-full max-w-[420px] flex flex-col items-center text-center"
                >
                    <motion.h2
                        variants={itemVariants}
                        style={{
                            fontSize: 32,
                            fontWeight: 500,
                            letterSpacing: "-0.03em",
                            color: "#201e24",
                            lineHeight: 1.2,
                            margin: "0 0 12px 0",
                        }}
                    >
                        Welcome Back
                    </motion.h2>

                    <motion.p
                        variants={itemVariants}
                        style={{
                            fontSize: 14,
                            color: "#8a8886",
                            fontWeight: 400,
                            lineHeight: 1.6,
                            margin: "0 0 36px 0",
                            maxWidth: 340,
                        }}
                    >
                        Sign in to continue, or jump straight in as a guest.
                    </motion.p>

                    <motion.div variants={itemVariants} className="w-full" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* Google Auth (Disabled for now) */}
                        <div className="w-full">
                            <button
                                disabled
                                style={{
                                    width: "100%",
                                    padding: "15px 24px",
                                    backgroundColor: "transparent",
                                    border: "1px solid #e8e6d9",
                                    color: "#a1a1aa",
                                    borderRadius: "12px",
                                    fontWeight: 600,
                                    fontSize: "15px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 12,
                                    cursor: "not-allowed",
                                    opacity: 0.6,
                                    fontFamily: "var(--font-sans)",
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-60 saturate-0">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.83z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Continue with Google
                                <span className="ml-2 text-[10px] uppercase font-bold text-[#8a8886] bg-[#f4f4f4] px-2 py-0.5 rounded">Soon</span>
                            </button>
                        </div>

                        {/* Guest Auth */}
                        <motion.div className="w-full" whileTap={{ scale: 0.98 }}>
                            <button
                                onClick={handleGuestLogin}
                                disabled={isGuestLoading}
                                style={{
                                    width: "100%",
                                    padding: "15px 24px",
                                    backgroundColor: "#111111",
                                    color: "#ffffff",
                                    borderRadius: "12px",
                                    fontWeight: 600,
                                    fontSize: "15px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 12,
                                    border: "none",
                                    cursor: isGuestLoading ? "wait" : "pointer",
                                    fontFamily: "var(--font-sans)",
                                    boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                                    transition: "background-color 0.2s ease, box-shadow 0.2s ease",
                                }}
                            >
                                {isGuestLoading ? (
                                    <div className="flex items-center gap-1.5 h-5">
                                        {[0, 1, 2].map((i) => (
                                            <motion.span
                                                key={i}
                                                className="w-1.5 h-1.5 bg-[#ffffff] rounded-full"
                                                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                                                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        Continue as Guest
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-80">
                                            <path d="M5 12h14" />
                                            <path d="M12 5l7 7-7 7" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
