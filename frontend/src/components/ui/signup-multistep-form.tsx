"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CheckIcon, ArrowRightIcon } from "lucide-react"

type Step = {
  id: number
  label: string
  field: string
  placeholder: string
  type?: string
}

const steps: Step[] = [
  { id: 1, label: "Full Name", field: "fullName", placeholder: "Enter your full name" },
  { id: 2, label: "Email", field: "email", placeholder: "you@example.com", type: "email" },
  { id: 3, label: "Password", field: "password", placeholder: "Create a secure password", type: "password" },
]

interface SignupMultiStepFormProps {
  onComplete: (data: { fullName: string; email: string; password: string }) => void
  errors?: Record<string, string>
}

export function SignupMultiStepForm({ onComplete, errors = {} }: SignupMultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, string>>({})

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete({
        fullName: formData.fullName || "",
        email: formData.email || "",
        password: formData.password || "",
      })
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100
  const hasError = errors[currentStepData.field] ? true : false
  const canProceed = formData[currentStepData.field]?.trim() && !hasError

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Step Indicator */}
      <div className="mb-10 flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => index < currentStep && setCurrentStep(index)}
              disabled={index > currentStep}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ease-out border-2",
                "disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                index < currentStep && "bg-primary-600 text-white border-primary-600 shadow-md",
                index === currentStep && "bg-primary-600 text-white border-primary-600 shadow-lg scale-110",
                index > currentStep && "bg-white text-gray-400 border-gray-300",
              )}
            >
              {index < currentStep ? (
                <CheckIcon className="h-5 w-5" strokeWidth={2.5} />
              ) : (
                <span className="text-sm font-semibold tabular-nums">{step.id}</span>
              )}
            </button>
            {index < steps.length - 1 && (
              <div className="relative h-0.5 w-16">
                <div className="absolute inset-0 bg-gray-200 rounded-full" />
                <div
                  className="absolute inset-0 bg-primary-600 rounded-full transition-all duration-500 ease-out origin-left"
                  style={{
                    transform: `scaleX(${index < currentStep ? 1 : 0})`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mb-8 overflow-hidden rounded-full bg-gray-100 h-1.5 border border-gray-200">
        <div
          className="h-full bg-primary-600 transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Form Content */}
      <div className="space-y-6">
        <div key={currentStepData.id} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-baseline justify-between mb-1">
            <Label htmlFor={currentStepData.field} className="text-lg font-semibold text-gray-900">
              {currentStepData.label}
            </Label>
            <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
              {currentStep + 1}/{steps.length}
            </span>
          </div>
          
          <div className="relative">
            <Input
              id={currentStepData.field}
              type={currentStepData.type || "text"}
              placeholder={currentStepData.placeholder}
              value={formData[currentStepData.field] || ""}
              onChange={(e) => handleInputChange(currentStepData.field, e.target.value)}
              autoFocus
              className={cn(
                "h-14 text-base border-2 transition-all duration-200",
                "focus:border-primary-500 focus:ring-2 focus:ring-primary-200",
                hasError 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-gray-300"
              )}
            />
            {hasError && (
              <p className="mt-2 text-sm text-red-600 font-medium">{errors[currentStepData.field]}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="w-full h-14 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              {currentStep === steps.length - 1 ? "Create Account" : "Continue"}
              <ArrowRightIcon
                className="h-5 w-5 transition-transform group-hover:translate-x-1 duration-300"
                strokeWidth={2.5}
              />
            </span>
          </Button>

          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="w-full text-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2 rounded-md hover:bg-gray-50"
            >
              ← Go back
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

