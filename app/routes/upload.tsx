import {type FormEvent, useState} from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {useNavigate} from "react-router";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);


    const handleFileSelect = (file: File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File  }) => {
        setIsProcessing(true);

        try {
            // Step 1: Upload the PDF file to Puter FS
            setStatusText('Uploading resume file...');
            const uploadedFile = await fs.upload([file]);
            if(!uploadedFile) {
                setStatusText('Error: Failed to upload resume. Please try again.');
                setIsProcessing(false);
                return;
            }

            // Step 2: Convert PDF first page to image for display
            setStatusText('Converting resume to image...');
            const imageFile = await convertPdfToImage(file);
            if(!imageFile.file) {
                setStatusText('Error: Failed to convert PDF to image. Make sure it is a valid PDF.');
                setIsProcessing(false);
                return;
            }

            // Step 3: Upload the image to Puter FS (for display on results page)
            setStatusText('Uploading resume preview...');
            const uploadedImage = await fs.upload([imageFile.file]);
            if(!uploadedImage) {
                setStatusText('Error: Failed to upload image preview.');
                setIsProcessing(false);
                return;
            }

            // Step 4: Save data record
            const uuid = generateUUID();
            const data: any = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path,
                companyName, jobTitle, jobDescription,
                feedback: '',
            }
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            // Step 6: Send image + instructions to AI via Puter
            setStatusText('Analyzing resume with AI (this may take up to 2 minutes)...');

            const instructions = prepareInstructions({ jobTitle, jobDescription });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('AI analysis timed out after 2 minutes. Please try again.')), 120000)
            );

            // Correct Puter API: chat(prompt, mediaFile, testMode, options)
            // Pass the PNG image File as the 2nd argument (media)
            const aiPromise = ai.chat(
                instructions,
                imageFile.file as any,
                false,
                { model: 'gpt-4o-mini' }
            );

            const feedback = await Promise.race([aiPromise, timeoutPromise]);

            if (!feedback) {
                setStatusText('Error: AI returned no response. Please try again.');
                setIsProcessing(false);
                return;
            }

            // Step 7: Parse the AI response
            const rawContent = typeof feedback.message.content === 'string'
                ? feedback.message.content
                : Array.isArray(feedback.message.content)
                    ? (feedback.message.content[0]?.text ?? '')
                    : '';

            if (!rawContent) {
                setStatusText('Error: Empty AI response received. Please try again.');
                setIsProcessing(false);
                return;
            }

            // Strip markdown code fences if AI wraps the JSON
            const feedbackText = rawContent
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```\s*$/, '')
                .trim();

            let parsedFeedback: any;
            try {
                parsedFeedback = JSON.parse(feedbackText);
            } catch (parseErr) {
                console.error('JSON parse error. Raw AI response:', rawContent);
                setStatusText('Error: AI returned invalid JSON. Please try again.');
                setIsProcessing(false);
                return;
            }

            // Step 8: Save final data and navigate to results
            data.feedback = parsedFeedback;
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText('Analysis complete! Redirecting to results...');
            console.log('Resume analysis complete:', data);
            navigate(`/resume/${uuid}`);

        } catch (err) {
            console.error('Resume analysis error:', err);
            console.error('Error details (stringify):', JSON.stringify(err));
            let msg = 'An unexpected error occurred.';
            if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === 'object' && err !== null) {
                const e = err as any;
                msg = e.message || e.error?.message || e.error || JSON.stringify(err);
            }
            setStatusText(`Error: ${msg}`);
            setIsProcessing(false);
        }
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) {
            alert('Please select a PDF resume file first.');
            return;
        }

        handleAnalyze({ companyName, jobTitle, jobDescription, file });
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2 className={statusText.startsWith('Error:') ? 'text-red-500' : ''}>
                                {statusText}
                            </h2>
                            {!statusText.startsWith('Error:') && (
                                <img src="/images/resume-scan.gif" className="w-full" />
                            )}
                            {statusText.startsWith('Error:') && (
                                <button
                                    className="primary-button mt-4"
                                    onClick={() => setIsProcessing(false)}
                                >
                                    Try Again
                                </button>
                            )}
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>

                            <button className="primary-button" type="submit">
                                Analyze Resume
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}
export default Upload
