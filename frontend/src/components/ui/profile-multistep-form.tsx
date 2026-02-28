"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CheckIcon, ArrowRightIcon, Star, Trash2, Plus } from "lucide-react"
import InterestTags from "../profile/InterestTags"
import ProfilePrompts from "../profile/ProfilePrompts"
import SocialMediaLinks from "../profile/SocialMediaLinks"
import SpotifyIntegration from "../profile/SpotifyIntegration"
import { API_BASE_URL } from "../../utils/api"
import { getImageUrl } from "../../utils/cloudinary"
import { ImageLightbox } from "./ImageLightbox"

interface ProfileMultiStepFormProps {
  initialData?: Record<string, any>
  onComplete: (data: Record<string, any>) => void
  onStepChange?: (step: number) => void
  onFormDataChange?: (data: Record<string, any>) => void
  isPremium?: boolean
  profile?: any
  onFileUpload?: (e: any, field: string) => void
  onSetAsProfilePhoto?: (photoUrl: string) => void
  onDeletePhoto?: (photoUrl: string) => void
  onDeleteProfilePhoto?: () => void
  maxPhotos?: number
}

export function ProfileMultiStepForm({
  initialData = {},
  onComplete,
  onStepChange,
  onFormDataChange,
  isPremium = false,
  profile,
  onFileUpload,
  onSetAsProfilePhoto,
  onDeletePhoto,
  onDeleteProfilePhoto,
  maxPhotos = 6
}: ProfileMultiStepFormProps) {
  // Always start on the first tab when opening Edit profile (user preference).
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>(initialData)
  const [lightbox, setLightbox] = useState<{ open: boolean; src: string | null; alt: string }>({ open: false, src: null, alt: '' })

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData])

  const steps = [
    { id: 1, name: "Basic Info" },
    { id: 2, name: "Lifestyle" },
    { id: 3, name: "Family" },
    { id: 4, name: "Kundli" },
    { id: 5, name: "Education" },
    { id: 6, name: "Preferences" },
    { id: 7, name: "Personality" },
    { id: 8, name: "Enhanced" },
  ]

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      onStepChange?.(nextStep)
    } else {
      onComplete(formData)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    const next = { ...formData, [field]: value }
    setFormData(next)
    onFormDataChange?.(next)
  }

  const handleNestedChange = (parent: string, child: string, value: any) => {
    const next = {
      ...formData,
      [parent]: {
        ...(formData[parent] || {}),
        [child]: value
      }
    }
    setFormData(next)
    onFormDataChange?.(next)
  }

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  // Validation for each step
  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return formData.firstName && formData.lastName && formData.gender && formData.dateOfBirth && formData.city
      case 1: // Lifestyle
        return true // All optional
      case 2: // Family & Background
        return true // All optional
      case 3: // Horoscope & Kundli
        return true // All optional
      case 4: // Education
        return true // All optional
      case 5: // Preferences
        return true // All optional
      case 6: // Personality
        return true // All optional
      case 7: // Enhanced
        return true // All optional
      default:
        return false
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Step Indicator - responsive: smaller on mobile, full size on md+ */}
      <div className="mb-6 sm:mb-10 flex items-center justify-center overflow-x-auto pb-2 -mx-1 px-1 min-h-[2.5rem] sm:min-h-0">
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => index < currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={cn(
                  "group relative flex items-center justify-center rounded-full transition-all duration-300 ease-out border-2 flex-shrink-0 overflow-visible",
                  "h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 min-h-[2rem] sm:min-h-[2.25rem] md:min-h-[2.5rem]",
                  "disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 sm:focus:ring-offset-2",
                  index < currentStep && "bg-green-600 text-white border-green-600 shadow-md",
                  index === currentStep && "bg-primary-600 text-white border-primary-600 shadow-lg scale-105 sm:scale-110",
                  index > currentStep && "bg-white text-gray-400 border-gray-300",
                )}
              >
                {index < currentStep ? (
                  <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" strokeWidth={2.5} />
                ) : (
                  <span className="text-xs sm:text-sm font-semibold tabular-nums leading-none flex items-center justify-center">{step.id}</span>
                )}
              </button>
              {index < steps.length - 1 && (
                <div className="relative h-0.5 w-3 sm:w-6 md:w-8 lg:w-12 flex-shrink-0">
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
        {/* Step 1: Basic Information */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Basic Information</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-gray-900">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Enter your first name"
                  value={formData.firstName || ""}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="h-12 border-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-gray-900">
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Enter your last name"
                  value={formData.lastName || ""}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="h-12 border-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm font-medium text-gray-900">
                  Gender *
                </Label>
                <select
                  id="gender"
                  value={formData.gender || ""}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-900">
                  Date of Birth *
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth ? formData.dateOfBirth.split('T')[0] : ""}
                  onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                  className="h-12 border-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-sm font-medium text-gray-900">
                  Height (cm)
                </Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="170"
                  value={formData.height || ""}
                  onChange={(e) => handleInputChange("height", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm font-medium text-gray-900">
                  Weight (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="70"
                  value={formData.weight || ""}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="city" className="text-sm font-medium text-gray-900">
                  City *
                </Label>
                <select
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  required
                >
                  <option value="">Select City</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Mohali">Mohali</option>
                  <option value="Panchkula">Panchkula</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Lifestyle */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Lifestyle</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skinTone" className="text-sm font-medium text-gray-900">
                  Skin Tone
                </Label>
                <select
                  id="skinTone"
                  value={formData.skinTone || ""}
                  onChange={(e) => handleInputChange("skinTone", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="fair">Fair</option>
                  <option value="wheatish">Wheatish</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diet" className="text-sm font-medium text-gray-900">
                  Diet
                </Label>
                <select
                  id="diet"
                  value={formData.diet || ""}
                  onChange={(e) => handleInputChange("diet", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="jain">Jain</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smoking" className="text-sm font-medium text-gray-900">
                  Smoking
                </Label>
                <select
                  id="smoking"
                  value={formData.smoking || ""}
                  onChange={(e) => handleInputChange("smoking", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="never">Never</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="regularly">Regularly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drinking" className="text-sm font-medium text-gray-900">
                  Drinking
                </Label>
                <select
                  id="drinking"
                  value={formData.drinking || ""}
                  onChange={(e) => handleInputChange("drinking", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="never">Never</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="regularly">Regularly</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Family & Background */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Family & Background</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="religion" className="text-sm font-medium text-gray-900">
                  Religion
                </Label>
                <select
                  id="religion"
                  value={formData.religion || ""}
                  onChange={(e) => handleInputChange("religion", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select Religion</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Sikh">Sikh</option>
                  <option value="Muslim">Muslim</option>
                  <option value="Christian">Christian</option>
                  <option value="Jain">Jain</option>
                  <option value="Buddhist">Buddhist</option>
                  <option value="Parsi">Parsi</option>
                  <option value="Jewish">Jewish</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="caste" className="text-sm font-medium text-gray-900">
                  Caste
                </Label>
                <Input
                  id="caste"
                  type="text"
                  placeholder="e.g., Brahmin, Khatri, Jat"
                  value={formData.caste || ""}
                  onChange={(e) => handleInputChange("caste", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCaste" className="text-sm font-medium text-gray-900">
                  Sub-Caste
                </Label>
                <Input
                  id="subCaste"
                  type="text"
                  placeholder="e.g., Agarwal, Maheshwari"
                  value={formData.subCaste || ""}
                  onChange={(e) => handleInputChange("subCaste", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gotra" className="text-sm font-medium text-gray-900">
                  Gotra
                </Label>
                <Input
                  id="gotra"
                  type="text"
                  placeholder="Family gotra / clan"
                  value={formData.gotra || ""}
                  onChange={(e) => handleInputChange("gotra", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherTongue" className="text-sm font-medium text-gray-900">
                  Mother Tongue
                </Label>
                <select
                  id="motherTongue"
                  value={formData.motherTongue || ""}
                  onChange={(e) => handleInputChange("motherTongue", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select Mother Tongue</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="English">English</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Malayalam">Malayalam</option>
                  <option value="Odia">Odia</option>
                  <option value="Sindhi">Sindhi</option>
                  <option value="Dogri">Dogri</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maritalStatus" className="text-sm font-medium text-gray-900">
                  Marital Status
                </Label>
                <select
                  id="maritalStatus"
                  value={formData.maritalStatus || ""}
                  onChange={(e) => handleInputChange("maritalStatus", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select Marital Status</option>
                  <option value="never_married">Never Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="awaiting_divorce">Awaiting Divorce</option>
                </select>
              </div>
              {(formData.maritalStatus === 'divorced' || formData.maritalStatus === 'widowed') && (
                <div className="space-y-2">
                  <Label htmlFor="numberOfChildren" className="text-sm font-medium text-gray-900">
                    Number of Children
                  </Label>
                  <Input
                    id="numberOfChildren"
                    type="number"
                    min={0}
                    max={10}
                    placeholder="0"
                    value={formData.numberOfChildren ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
                      handleInputChange("numberOfChildren", v);
                    }}
                    className="h-12 border-2"
                  />
                </div>
              )}
            </div>

            {/* Family Details Sub-section */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-base font-medium text-gray-800 mb-4">Family Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="familyType" className="text-sm font-medium text-gray-900">
                    Family Type
                  </Label>
                  <select
                    id="familyType"
                    value={formData.familyType || ""}
                    onChange={(e) => handleInputChange("familyType", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="joint">Joint Family</option>
                    <option value="nuclear">Nuclear Family</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="familyStatus" className="text-sm font-medium text-gray-900">
                    Family Status
                  </Label>
                  <select
                    id="familyStatus"
                    value={formData.familyStatus || ""}
                    onChange={(e) => handleInputChange("familyStatus", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="middle_class">Middle Class</option>
                    <option value="upper_middle_class">Upper Middle Class</option>
                    <option value="affluent">Affluent</option>
                    <option value="rich">Rich</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fatherOccupation" className="text-sm font-medium text-gray-900">
                    Father's Occupation
                  </Label>
                  <Input
                    id="fatherOccupation"
                    type="text"
                    placeholder="e.g., Business, Government Service"
                    value={formData.fatherOccupation || ""}
                    onChange={(e) => handleInputChange("fatherOccupation", e.target.value)}
                    className="h-12 border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motherOccupation" className="text-sm font-medium text-gray-900">
                    Mother's Occupation
                  </Label>
                  <Input
                    id="motherOccupation"
                    type="text"
                    placeholder="e.g., Homemaker, Teacher"
                    value={formData.motherOccupation || ""}
                    onChange={(e) => handleInputChange("motherOccupation", e.target.value)}
                    className="h-12 border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfSiblings" className="text-sm font-medium text-gray-900">
                    Number of Siblings
                  </Label>
                  <Input
                    id="numberOfSiblings"
                    type="number"
                    min={0}
                    max={15}
                    placeholder="0"
                    value={formData.numberOfSiblings ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Math.max(0, Math.min(15, parseInt(e.target.value, 10) || 0));
                      handleInputChange("numberOfSiblings", v);
                    }}
                    className="h-12 border-2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Horoscope & Kundli */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Horoscope & Kundli</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            <p className="text-gray-500 text-sm">
              These details help families match kundlis for compatibility. All fields are optional.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="placeOfBirth" className="text-sm font-medium text-gray-900">
                  Place of Birth
                </Label>
                <Input
                  id="placeOfBirth"
                  type="text"
                  placeholder="City / Town of birth"
                  value={formData.placeOfBirth || ""}
                  onChange={(e) => handleInputChange("placeOfBirth", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthTime" className="text-sm font-medium text-gray-900">
                  Birth Time
                </Label>
                <Input
                  id="birthTime"
                  type="time"
                  value={formData.birthTime || ""}
                  onChange={(e) => handleInputChange("birthTime", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manglikStatus" className="text-sm font-medium text-gray-900">
                  Manglik Status
                </Label>
                <select
                  id="manglikStatus"
                  value={formData.manglikStatus || ""}
                  onChange={(e) => handleInputChange("manglikStatus", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="manglik">Manglik</option>
                  <option value="non_manglik">Non-Manglik</option>
                  <option value="anshik_manglik">Anshik Manglik</option>
                  <option value="not_sure">Not Sure</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zodiacSign" className="text-sm font-medium text-gray-900">
                  Zodiac Sign (Western)
                </Label>
                <select
                  id="zodiacSign"
                  value={formData.zodiacSign || ""}
                  onChange={(e) => handleInputChange("zodiacSign", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="Aries">♈ Aries (Mar 21 – Apr 19)</option>
                  <option value="Taurus">♉ Taurus (Apr 20 – May 20)</option>
                  <option value="Gemini">♊ Gemini (May 21 – Jun 20)</option>
                  <option value="Cancer">♋ Cancer (Jun 21 – Jul 22)</option>
                  <option value="Leo">♌ Leo (Jul 23 – Aug 22)</option>
                  <option value="Virgo">♍ Virgo (Aug 23 – Sep 22)</option>
                  <option value="Libra">♎ Libra (Sep 23 – Oct 22)</option>
                  <option value="Scorpio">♏ Scorpio (Oct 23 – Nov 21)</option>
                  <option value="Sagittarius">♐ Sagittarius (Nov 22 – Dec 21)</option>
                  <option value="Capricorn">♑ Capricorn (Dec 22 – Jan 19)</option>
                  <option value="Aquarius">♒ Aquarius (Jan 20 – Feb 18)</option>
                  <option value="Pisces">♓ Pisces (Feb 19 – Mar 20)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rashi" className="text-sm font-medium text-gray-900">
                  Rashi (Moon Sign)
                </Label>
                <select
                  id="rashi"
                  value={formData.rashi || ""}
                  onChange={(e) => handleInputChange("rashi", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="Mesh">Mesh (Aries)</option>
                  <option value="Vrishabh">Vrishabh (Taurus)</option>
                  <option value="Mithun">Mithun (Gemini)</option>
                  <option value="Kark">Kark (Cancer)</option>
                  <option value="Singh">Singh (Leo)</option>
                  <option value="Kanya">Kanya (Virgo)</option>
                  <option value="Tula">Tula (Libra)</option>
                  <option value="Vrishchik">Vrishchik (Scorpio)</option>
                  <option value="Dhanu">Dhanu (Sagittarius)</option>
                  <option value="Makar">Makar (Capricorn)</option>
                  <option value="Kumbh">Kumbh (Aquarius)</option>
                  <option value="Meen">Meen (Pisces)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nakshatra" className="text-sm font-medium text-gray-900">
                  Nakshatra (Birth Star)
                </Label>
                <select
                  id="nakshatra"
                  value={formData.nakshatra || ""}
                  onChange={(e) => handleInputChange("nakshatra", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="Ashwini">Ashwini</option>
                  <option value="Bharani">Bharani</option>
                  <option value="Krittika">Krittika</option>
                  <option value="Rohini">Rohini</option>
                  <option value="Mrigashira">Mrigashira</option>
                  <option value="Ardra">Ardra</option>
                  <option value="Punarvasu">Punarvasu</option>
                  <option value="Pushya">Pushya</option>
                  <option value="Ashlesha">Ashlesha</option>
                  <option value="Magha">Magha</option>
                  <option value="Purva Phalguni">Purva Phalguni</option>
                  <option value="Uttara Phalguni">Uttara Phalguni</option>
                  <option value="Hasta">Hasta</option>
                  <option value="Chitra">Chitra</option>
                  <option value="Swati">Swati</option>
                  <option value="Vishakha">Vishakha</option>
                  <option value="Anuradha">Anuradha</option>
                  <option value="Jyeshtha">Jyeshtha</option>
                  <option value="Moola">Moola</option>
                  <option value="Purva Ashadha">Purva Ashadha</option>
                  <option value="Uttara Ashadha">Uttara Ashadha</option>
                  <option value="Shravana">Shravana</option>
                  <option value="Dhanishta">Dhanishta</option>
                  <option value="Shatabhisha">Shatabhisha</option>
                  <option value="Purva Bhadrapada">Purva Bhadrapada</option>
                  <option value="Uttara Bhadrapada">Uttara Bhadrapada</option>
                  <option value="Revati">Revati</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Education & Profession */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Education & Profession</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="education" className="text-sm font-medium text-gray-900">
                  Education
                </Label>
                <Input
                  id="education"
                  type="text"
                  placeholder="B.Tech, MBA, etc."
                  value={formData.education || ""}
                  onChange={(e) => handleInputChange("education", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="degree" className="text-sm font-medium text-gray-900">
                  Degree
                </Label>
                <Input
                  id="degree"
                  type="text"
                  placeholder="Computer Science, etc."
                  value={formData.degree || ""}
                  onChange={(e) => handleInputChange("degree", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profession" className="text-sm font-medium text-gray-900">
                  Profession
                </Label>
                <Input
                  id="profession"
                  type="text"
                  placeholder="Software Engineer, Doctor, etc."
                  value={formData.profession || ""}
                  onChange={(e) => handleInputChange("profession", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income" className="text-sm font-medium text-gray-900">
                  Annual Income (₹)
                </Label>
                <Input
                  id="income"
                  type="number"
                  placeholder="500000"
                  value={formData.income || ""}
                  onChange={(e) => handleInputChange("income", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Preferences */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Partner Preferences</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredAgeMin" className="text-sm font-medium text-gray-900">
                  Preferred Age Min
                </Label>
                <Input
                  id="preferredAgeMin"
                  type="number"
                  placeholder="22"
                  value={formData.preferredAgeMin || ""}
                  onChange={(e) => handleInputChange("preferredAgeMin", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredAgeMax" className="text-sm font-medium text-gray-900">
                  Preferred Age Max
                </Label>
                <Input
                  id="preferredAgeMax"
                  type="number"
                  placeholder="30"
                  value={formData.preferredAgeMax || ""}
                  onChange={(e) => handleInputChange("preferredAgeMax", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredHeightMin" className="text-sm font-medium text-gray-900">
                  Preferred Height Min (cm)
                </Label>
                <Input
                  id="preferredHeightMin"
                  type="number"
                  placeholder="150"
                  value={formData.preferredHeightMin || ""}
                  onChange={(e) => handleInputChange("preferredHeightMin", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredHeightMax" className="text-sm font-medium text-gray-900">
                  Preferred Height Max (cm)
                </Label>
                <Input
                  id="preferredHeightMax"
                  type="number"
                  placeholder="170"
                  value={formData.preferredHeightMax || ""}
                  onChange={(e) => handleInputChange("preferredHeightMax", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredEducation" className="text-sm font-medium text-gray-900">
                  Preferred Education
                </Label>
                <Input
                  id="preferredEducation"
                  type="text"
                  placeholder="B.Tech, MBA, etc."
                  value={formData.preferredEducation || ""}
                  onChange={(e) => handleInputChange("preferredEducation", e.target.value)}
                  className="h-12 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredCity" className="text-sm font-medium text-gray-900">
                  Preferred City
                </Label>
                <select
                  id="preferredCity"
                  value={formData.preferredCity?.[0] || ""}
                  onChange={(e) => handleInputChange("preferredCity", [e.target.value])}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Mohali">Mohali</option>
                  <option value="Panchkula">Panchkula</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Personality */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Personality & Bio</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-medium text-gray-900">
                  Bio
                </Label>
                <textarea
                  id="bio"
                  value={formData.bio || ""}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-gray-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="familyOriented" className="text-sm font-medium text-gray-900">
                    Family Oriented
                  </Label>
                  <select
                    id="familyOriented"
                    value={formData.personalityValues?.familyOriented || ""}
                    onChange={(e) => handleNestedChange("personalityValues", "familyOriented", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careerFocused" className="text-sm font-medium text-gray-900">
                    Career Focused
                  </Label>
                  <select
                    id="careerFocused"
                    value={formData.personalityValues?.careerFocused || ""}
                    onChange={(e) => handleNestedChange("personalityValues", "careerFocused", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jointFamily" className="text-sm font-medium text-gray-900">
                    Joint Family Preference
                  </Label>
                  <select
                    id="jointFamily"
                    value={formData.familyPreferences?.jointFamily || ""}
                    onChange={(e) => handleNestedChange("familyPreferences", "jointFamily", e.target.value)}
                    className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="children" className="text-sm font-medium text-gray-900">
                    Desired Children
                  </Label>
                  <Input
                    id="children"
                    type="number"
                    min={0}
                    max={20}
                    placeholder="0"
                    value={formData.familyPreferences?.children ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0));
                      handleNestedChange("familyPreferences", "children", v);
                    }}
                    className="h-12 border-2"
                  />
                </div>
              </div>

              {profile && onFileUpload && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-900">
                      Photos (up to {maxPhotos})
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Your main profile photo is shown on cards and search. Choose it below. All photos are visible when someone opens your profile.
                    </p>
                  </div>
                  {(() => {
                    const displayPhotos =
                      profile.profilePhoto && !(profile.photos || []).includes(profile.profilePhoto)
                        ? [profile.profilePhoto, ...(profile.photos || [])]
                        : (profile.photos || [])
                    const cellClass = "w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100"
                    return (
                      <>
                        <div className="flex flex-wrap items-start gap-3">
                          {/* Add photo button first — same size as photo cells */}
                          {displayPhotos.length < maxPhotos && (
                            <label className={`${cellClass} border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors`}>
                              <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                multiple
                                onChange={(e) => onFileUpload(e, 'photos')}
                                className="hidden"
                              />
                              <Plus className="w-8 h-8 text-gray-400 mb-1" />
                              <span className="text-xs font-medium text-gray-600">Add photo{maxPhotos - displayPhotos.length > 1 ? 's' : ''}</span>
                            </label>
                          )}
                          {/* Uploaded photos next to the button, same size */}
                          {displayPhotos.map((photoUrl: string, index: number) => (
                            <div
                              key={photoUrl}
                              className={`${cellClass} relative flex flex-col`}
                            >
                              <div className="relative flex-1 min-h-0">
                                <img
                                  src={getImageUrl(photoUrl, API_BASE_URL, 'gallery')}
                                  alt={`Photo ${index + 1}`}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setLightbox({ open: true, src: getImageUrl(photoUrl, API_BASE_URL, 'full'), alt: `Photo ${index + 1}` })}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => e.key === 'Enter' && setLightbox({ open: true, src: getImageUrl(photoUrl, API_BASE_URL, 'full'), alt: `Photo ${index + 1}` })}
                                />
                                {profile.profilePhoto === photoUrl && (
                                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-primary-600 text-white text-[10px] sm:text-xs font-medium flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                                    Main
                                  </span>
                                )}
                              </div>
                              {/* Always-visible strip: mobile-friendly touch targets (min 44px), compact on desktop */}
                              <div className="absolute bottom-0 left-0 right-0 flex bg-black/60 backdrop-blur-sm">
                                {profile.profilePhoto !== photoUrl && onSetAsProfilePhoto && (
                                  <button
                                    type="button"
                                    onClick={() => onSetAsProfilePhoto(photoUrl)}
                                    className="flex-1 min-h-[44px] sm:min-h-[36px] flex items-center justify-center gap-1 px-1.5 py-2 sm:py-1.5 rounded-none text-white text-[10px] sm:text-xs font-medium hover:bg-white/20 active:bg-white/30 touch-manipulation"
                                  >
                                    <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                    Main
                                  </button>
                                )}
                                {(profile.photos || []).includes(photoUrl)
                                  ? onDeletePhoto && (
                                    <button
                                      type="button"
                                      onClick={() => onDeletePhoto(photoUrl)}
                                      className="flex-1 min-h-[44px] sm:min-h-[36px] flex items-center justify-center gap-1 px-1.5 py-2 sm:py-1.5 rounded-none bg-red-600/90 text-white text-[10px] sm:text-xs font-medium hover:bg-red-600 active:bg-red-700 touch-manipulation"
                                    >
                                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                      Remove
                                    </button>
                                  )
                                  : onDeleteProfilePhoto && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteProfilePhoto()}
                                      className="flex-1 min-h-[44px] sm:min-h-[36px] flex items-center justify-center gap-1 px-1.5 py-2 sm:py-1.5 rounded-none bg-red-600/90 text-white text-[10px] sm:text-xs font-medium hover:bg-red-600 active:bg-red-700 touch-manipulation"
                                    >
                                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                      Remove
                                    </button>
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <ImageLightbox
                          src={lightbox.src}
                          alt={lightbox.alt}
                          open={lightbox.open}
                          onClose={() => setLightbox((p) => ({ ...p, open: false }))}
                        />
                      </>
                    )
                  })()}
                  <p className="text-xs text-gray-500">
                    Max 5MB per photo. JPEG, PNG or WebP. Stored on our servers and linked to your profile.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Enhanced */}
        {currentStep === 7 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xl font-semibold text-gray-900">Enhanced Profile Features</h3>
              <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 px-2 py-1 rounded-md">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <p className="text-gray-600 text-sm mb-6">
              Add more details to make your profile stand out and attract better matches!
            </p>

            <div className="space-y-6">
              {/* Interest Tags */}
              <InterestTags
                tags={formData.interestTags || []}
                onChange={(tags) => handleInputChange("interestTags", tags)}
              />

              {/* Profile Prompts */}
              <ProfilePrompts
                prompts={formData.profilePrompts || {}}
                onChange={(prompts) => handleInputChange("profilePrompts", prompts)}
              />

              {/* Spotify Integration */}
              <SpotifyIntegration
                playlistUrl={formData.spotifyPlaylist || ""}
                onChange={(url) => handleInputChange("spotifyPlaylist", url)}
              />

              {/* Social Media Links */}
              <SocialMediaLinks
                links={formData.socialMediaLinks || {}}
                onChange={(links) => handleInputChange("socialMediaLinks", links)}
                isPremium={isPremium}
              />

              {/* Languages */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Languages You Speak
                </Label>
                <div className="flex flex-wrap gap-2">
                  {['Hindi', 'English', 'Punjabi', 'Urdu', 'Sanskrit', 'Other'].map((lang) => {
                    const isSelected = (formData.languages || []).includes(lang)
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          const current = formData.languages || []
                          const updated = isSelected
                            ? current.filter(l => l !== lang)
                            : [...current, lang]
                          handleInputChange("languages", updated)
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-colors border-2",
                          isSelected
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                        )}
                      >
                        {lang}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Personality Type */}
              <div className="space-y-2">
                <Label htmlFor="personalityType" className="text-sm font-medium text-gray-900">
                  Personality Type (Optional)
                </Label>
                <select
                  id="personalityType"
                  value={formData.personalityType || ""}
                  onChange={(e) => handleInputChange("personalityType", e.target.value)}
                  className="flex h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="">Select (Optional)</option>
                  <option value="INTJ">INTJ - The Architect</option>
                  <option value="INTP">INTP - The Thinker</option>
                  <option value="ENTJ">ENTJ - The Commander</option>
                  <option value="ENTP">ENTP - The Debater</option>
                  <option value="INFJ">INFJ - The Advocate</option>
                  <option value="INFP">INFP - The Mediator</option>
                  <option value="ENFJ">ENFJ - The Protagonist</option>
                  <option value="ENFP">ENFP - The Campaigner</option>
                  <option value="ISTJ">ISTJ - The Logistician</option>
                  <option value="ISFJ">ISFJ - The Protector</option>
                  <option value="ESTJ">ESTJ - The Executive</option>
                  <option value="ESFJ">ESFJ - The Consul</option>
                  <option value="ISTP">ISTP - The Virtuoso</option>
                  <option value="ISFP">ISFP - The Adventurer</option>
                  <option value="ESTP">ESTP - The Entrepreneur</option>
                  <option value="ESFP">ESFP - The Entertainer</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Knowing your personality type helps us find better matches
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const prevStep = currentStep - 1
                setCurrentStep(prevStep)
                onStepChange?.(prevStep)
              }}
              className="flex-1 h-14 text-base font-semibold border-2"
            >
              ← Previous
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className={cn(
              "flex-1 h-14 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              currentStep === 0 && "w-full",
              !canProceed() && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {currentStep === steps.length - 1 ? "Complete Profile" : "Continue"}
              <ArrowRightIcon
                className="h-5 w-5 transition-transform group-hover:translate-x-1 duration-300"
                strokeWidth={2.5}
              />
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
