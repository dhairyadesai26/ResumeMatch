import {Link, useNavigate, useParams} from "react-router";
import {useEffect, useState} from "react";
import {usePuterStore} from "~/lib/puter";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";

export const meta = () => ([
    { title: 'ResumeMatch | Review ' },
    { name: 'description', content: 'Detailed overview of your resume' },
])

const Resume = () => {
    const { auth, isLoading, fs, kv } = usePuterStore();
    const { id } = useParams();
    const [imageUrl, setImageUrl] = useState('');
    const [resumeUrl, setResumeUrl] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [noFeedback, setNoFeedback] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if(!isLoading && !auth.isAuthenticated) navigate(`/auth?next=/resume/${id}`);
    }, [isLoading])

    useEffect(() => {
        const loadResume = async () => {
            const resume = await kv.get(`resume:${id}`);

            if(!resume) {
                setDataLoaded(true);
                setNoFeedback(true);
                return;
            }

            const data = JSON.parse(resume);

            // Check if this old scan has no feedback (was saved during a broken session)
            if(!data.feedback || data.feedback === '') {
                setDataLoaded(true);
                setNoFeedback(true);
                return;
            }

            const resumeBlob = await fs.read(data.resumePath);
            if(resumeBlob) {
                const pdfBlob = new Blob([resumeBlob], { type: 'application/pdf' });
                setResumeUrl(URL.createObjectURL(pdfBlob));
            }

            const imageBlob = await fs.read(data.imagePath);
            if(imageBlob) {
                setImageUrl(URL.createObjectURL(imageBlob));
            }

            setFeedback(data.feedback);
            setDataLoaded(true);
            console.log({ feedback: data.feedback });
        }

        loadResume();
    }, [id]);

    return (
        <main className="!pt-0">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg') bg-cover h-[100vh] sticky top-0 items-center justify-center">
                    {imageUrl && resumeUrl && (
                        <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-wxl:h-fit w-fit">
                            <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={imageUrl}
                                    className="w-full h-full object-contain rounded-2xl"
                                    title="resume"
                                />
                            </a>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl !text-black font-bold">Resume Review</h2>
                    {!dataLoaded ? (
                        // Still loading from KV/FS
                        <img src="/images/resume-scan-2.gif" className="w-full" />
                    ) : noFeedback ? (
                        // Old scan with no feedback - prompt user to re-upload
                        <div className="flex flex-col gap-4 animate-in fade-in duration-500 mt-6">
                            <p className="text-gray-600 text-lg">
                                This resume scan didn't complete successfully. The AI analysis is missing.
                            </p>
                            <p className="text-gray-500">
                                Please upload your resume again to get a fresh analysis.
                            </p>
                            <Link to="/upload" className="primary-button w-fit">
                                Upload Again
                            </Link>
                        </div>
                    ) : feedback ? (
                        // Has valid feedback
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            <Summary feedback={feedback} />
                            <ATS score={feedback.ATS.score || 0} suggestions={feedback.ATS.tips || []} />
                            <Details feedback={feedback} />
                        </div>
                    ) : (
                        <img src="/images/resume-scan-2.gif" className="w-full" />
                    )}
                </section>
            </div>
        </main>
    )
}
export default Resume
