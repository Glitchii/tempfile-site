import UploadIcon from '../assets/icons/upload.svg?react'
import FileIcon from '../assets/icons/file-icon.svg?react'
import IpBlacklistIcon from '../assets/icons/ip-blacklist.svg?react'
import IpWhitelistIcon from '../assets/icons/ip-whitelist.svg?react'
import PlusIcon from '../assets/icons/plus.svg?react'
import DownloadLimitIcon from '../assets/icons/download-limit.svg?react'
import PasswordIcon from '../assets/icons/password.svg?react'
import NameIcon from '../assets/icons/name.svg?react'
import DatetimeIcon from '../assets/icons/datetime.svg?react'
import ArrowLeftIcon from '../assets/icons/arrow-left.svg?react'
import AuthKeyIcon from '../assets/icons/auth-key.svg?react'
import QuestionMarkIcon from '../assets/icons/question-mark.svg?react'
import UploadCloudIcon from '../assets/icons/upload-cloud.svg?react'

export default function Home() {
    return (
        <>
            <main>
                <form action="/upload" method="post" encType="multipart/form-data">
                    <input type="file" id="upload" name="file" autoComplete="off" />
                    <input type="submit" className="submitInput" style={{ position: 'absolute', visibility: 'hidden' }} />
                    <div className="dragParent">
                        <label className="part drag" htmlFor="upload">
                            <div className="partInner">
                                <UploadIcon style={{ width: '250px', height: '100%' }} />
                                <img className="img otherImg" src="" alt="" style={{ width: '250px', height: '100%' }} />
                                <div className="img fileIcon">
                                    <p>File</p>
                                    <FileIcon style={{ fill: '#273036' }} />
                                </div>
                                <h2></h2>
                                <textarea spellCheck={false}></textarea>
                                <p className="desc">
                                    <span>Drag and drop any file or click anywere here to browse your device.</span>
                                </p>
                            </div>
                        </label>
                    </div>
                </form>
                <div className="part btns btnsInner">
                    <h2 className="optsTitle">Options</h2>
                    <div className="inner">
                        <div className="btn limit">
                            <div className="icon">
                                <DownloadLimitIcon />
                            </div>
                            <input className="input" type="number" min="1" placeholder="Download limit (empty = unliminted)" />
                        </div>
                        <div className="sep"></div>
                        <div className="btn pass">
                            <div className="icon">
                                <PasswordIcon />
                            </div>
                            <input className="input" type="password" placeholder="Password protect" />
                        </div>
                        <div className="sep"></div>
                        <div className="btn name">
                            <div className="icon">
                                <NameIcon />
                            </div>
                            <input className="input" type="text" placeholder="Custom file name" />
                        </div>
                        <div className="sep"></div>
                        <div className="btn ipBlackList">
                            <div className="icon">
                                <IpBlacklistIcon />
                            </div>
                            <div className="inputAndAddMore">
                                {/* <input className="input" type="text" placeholder="Restricted IP" /> */}
                                <input className="input" type="text" placeholder="Restrict access to an IP" />
                                <div className="addMore">
                                    <PlusIcon />
                                </div>
                            </div>
                        </div>
                        <div className="sep"></div>
                        <div className="btn ipWhiteList">
                            <div className="icon">
                                <IpWhitelistIcon />
                            </div>
                            <div className="inputAndAddMore">
                                <input className="input" type="text" placeholder="Restrict all IPS except" />
                                <div className="addMore">
                                    <PlusIcon />
                                </div>
                            </div>
                        </div>
                        <div className="sep"></div>
                        <div className="btn datetime">
                            <div className="icon">
                                <DatetimeIcon />
                            </div>
                            <p className="input">Auto delete in</p>
                        </div>
                        <div className="btn datetime-picker">
                            <select autoComplete="off" className="select btnUnder btnPad time" defaultValue="5m">
                                <option value="1m">1 Minute</option>
                                <option value="5m">5 Minutes</option>
                                <option value="10m">10 Minutes</option>
                                <option value="20m">20 Minutes</option>
                                <option value="30m">30 Minutes</option>
                                <option value="1h">1 Hour</option>
                                <option value="2h">2 Hours</option>
                                <option value="3h">3 Hours</option>
                                <option value="4h">4 Hours</option>
                                <option value="5h">5 Hours</option>
                                <option value="12h">12 Hours</option>
                                <option value="1d">1 day</option>
                                <option value="2d">2 days</option>
                                <option value="3d">3 days</option>
                                <option value="1w">1 Week</option>
                                <option value="2w">2 Weeks</option>
                                <option value="3w">3 Weeks</option>
                                <option value="1mo">1 Month</option>
                                <option value="" disabled>For custom time or date, update the date box below</option>
                            </select>
                            <div className="btnFollowUp time btnPad">
                                <input type="datetime-local" className="timeGui" />
                            </div>
                        </div>
                        <div className="controls before" title="See more options">
                            <div className="backControl">
                                <div className="controlText">More</div>
                                <ArrowLeftIcon style={{ width: '15px', transform: 'rotate(180deg)' }} />
                            </div>
                        </div>
                        <div className="btn authKey other">
                            <div className="icon">
                                <AuthKeyIcon />
                            </div>
                            <div className="qMarkAndTxt">
                                <p className="input">Authentication Key </p>
                                <div className="qMark">
                                    <QuestionMarkIcon>
                                        <title>This is a key required for actions like file deletions. Without it you can't delete a file through http requests</title>
                                    </QuestionMarkIcon>
                                </div>
                            </div>
                            <p className="qMarkDesc">By default, you can delete a file if it was uploaded from the same IP address you're uploading from. This key allows you to delete the file from a different IP address. This is especially useful with <a href="/api" className="URL">API requests</a>.</p>
                            <div className="inputOptions">
                                <input className="input btnPad" type="text" placeholder="Auth Key" defaultValue="<%= authKey %>" autoComplete="off" />
                                <div className="controls" title="Back to main options">
                                    <div className="backControl">
                                        <ArrowLeftIcon style={{ width: '15px' }} />
                                        <div className="controlText">Back</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="submit">
                        <div className="in">
                            <UploadCloudIcon className="upload" />
                            <span>Upload</span>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}