// Extended institution directory (added 2026-11-23 from the 1,000-entry list).
// One row per line: name|city|state|code[|country]. Codes: C central, S state,
// D deemed, P private university, N institute of national importance (resolved
// to iit/nit/iiit/research_institute by name), O other college/institute,
// F foreign university. Country defaults to IN. Duplicates of the core catalogue
// (by name or alias) and repeated rows are dropped in academic-catalog.ts.
export const DIRECTORY_ROWS = `
BITS Pilani|Pilani|Rajasthan|D
Thapar Institute of Engineering and Technology|Patiala|Punjab|D
Lovely Professional University|Phagwara|Punjab|P
Chandigarh University|Mohali|Punjab|P
Chitkara University|Rajpura|Punjab|P
Guru Nanak Dev University|Amritsar|Punjab|S
Panjab University|Chandigarh|Chandigarh|S
Punjab Engineering College|Chandigarh|Chandigarh|D
Delhi University|Delhi|Delhi|C
Jawaharlal Nehru University|New Delhi|Delhi|C
Jamia Millia Islamia|New Delhi|Delhi|C
Guru Gobind Singh Indraprastha University|New Delhi|Delhi|S
Amity University|Noida|Uttar Pradesh|P
Jaypee Institute of Information Technology|Noida|Uttar Pradesh|D
Shiv Nadar University|Dadri|Uttar Pradesh|P
Galgotias University|Greater Noida|Uttar Pradesh|P
Sharda University|Greater Noida|Uttar Pradesh|P
Bennett University|Greater Noida|Uttar Pradesh|P
Aligarh Muslim University|Aligarh|Uttar Pradesh|C
Banaras Hindu University|Varanasi|Uttar Pradesh|C
University of Lucknow|Lucknow|Uttar Pradesh|S
King George's Medical University|Lucknow|Uttar Pradesh|S
Motilal Nehru National Institute of Technology|Prayagraj|Uttar Pradesh|N
Harcourt Butler Technical University|Kanpur|Uttar Pradesh|S
Graphic Era University|Dehradun|Uttarakhand|D
UPES|Dehradun|Uttarakhand|P
DIT University|Dehradun|Uttarakhand|P
University of Kashmir|Srinagar|Jammu and Kashmir|S
Shri Mata Vaishno Devi University|Katra|Jammu and Kashmir|S
University of Mumbai|Mumbai|Maharashtra|S
Savitribai Phule Pune University|Pune|Maharashtra|S
College of Engineering Pune|Pune|Maharashtra|O
VIT Pune|Pune|Maharashtra|O
MIT World Peace University|Pune|Maharashtra|P
Symbiosis International University|Pune|Maharashtra|D
Bharati Vidyapeeth|Pune|Maharashtra|D
K. J. Somaiya Institute of Technology|Mumbai|Maharashtra|O
Tata Institute of Social Sciences|Mumbai|Maharashtra|D
Institute of Chemical Technology|Mumbai|Maharashtra|D
Nirma University|Ahmedabad|Gujarat|P
Gujarat University|Ahmedabad|Gujarat|S
Ahmedabad University|Ahmedabad|Gujarat|P
Pandit Deendayal Energy University|Gandhinagar|Gujarat|P
Sardar Vallabhbhai National Institute of Technology|Surat|Gujarat|N
Maharaja Sayajirao University of Baroda|Vadodara|Gujarat|S
Marwadi University|Rajkot|Gujarat|P
University of Rajasthan|Jaipur|Rajasthan|S
Manipal University Jaipur|Jaipur|Rajasthan|P
The LNM Institute of Information Technology|Jaipur|Rajasthan|D
University of Kota|Kota|Rajasthan|S
Mohanlal Sukhadia University|Udaipur|Rajasthan|S
Barkatullah University|Bhopal|Madhya Pradesh|S
Rajiv Gandhi Proudyogiki Vishwavidyalaya|Bhopal|Madhya Pradesh|S
Devi Ahilya Vishwavidyalaya|Indore|Madhya Pradesh|S
Jabalpur Engineering College|Jabalpur|Madhya Pradesh|O
Indian Institute of Science|Bengaluru|Karnataka|D
Visvesvaraya Technological University|Belagavi|Karnataka|S
PES University|Bengaluru|Karnataka|P
RV College of Engineering|Bengaluru|Karnataka|O
BMS College of Engineering|Bengaluru|Karnataka|O
Manipal Academy of Higher Education|Manipal|Karnataka|D
NITTE University|Mangaluru|Karnataka|D
Christ University|Bengaluru|Karnataka|D
Jain University|Bengaluru|Karnataka|D
University of Hyderabad|Hyderabad|Telangana|C
Osmania University|Hyderabad|Telangana|S
International Institute of Information Technology Hyderabad|Hyderabad|Telangana|D
Mahindra University|Hyderabad|Telangana|P
Jawaharlal Nehru Technological University Hyderabad|Hyderabad|Telangana|S
Kakatiya University|Warangal|Telangana|S
Andhra University|Visakhapatnam|Andhra Pradesh|S
GITAM Deemed University|Visakhapatnam|Andhra Pradesh|D
KL University|Vaddeswaram|Andhra Pradesh|D
Vignan's Foundation for Science, Technology and Research|Guntur|Andhra Pradesh|D
Sri Venkateswara University|Tirupati|Andhra Pradesh|S
VIT-AP University|Amaravati|Andhra Pradesh|P
SRM University AP|Amaravati|Andhra Pradesh|P
University of Madras|Chennai|Tamil Nadu|S
Anna University|Chennai|Tamil Nadu|S
SRM Institute of Science and Technology|Chennai|Tamil Nadu|D
Vellore Institute of Technology|Vellore|Tamil Nadu|D
SASTRA Deemed University|Thanjavur|Tamil Nadu|D
Jadavpur University|Kolkata|West Bengal|S
University of Calcutta|Kolkata|West Bengal|S
Techno India University|Kolkata|West Bengal|P
Siksha 'O' Anusandhan|Bhubaneswar|Odisha|D
Utkal University|Bhubaneswar|Odisha|S
Gauhati University|Guwahati|Assam|S
Tezpur University|Tezpur|Assam|C
Roorkee Institute of Technology|Roorkee|Uttarakhand|O
National Institute of Technology Uttarakhand|Srinagar (Garhwal)|Uttarakhand|N
Kumaun University|Nainital|Uttarakhand|S
Hemvati Nandan Bahuguna Garhwal University|Srinagar (Garhwal)|Uttarakhand|C
Uttarakhand Technical University|Dehradun|Uttarakhand|S
Doon University|Dehradun|Uttarakhand|S
Uttaranchal University|Dehradun|Uttarakhand|P
Sardar Bhagwan Singh University|Dehradun|Uttarakhand|P
Dev Sanskriti Vishwavidyalaya|Haridwar|Uttarakhand|P
Central University of Himachal Pradesh|Dharamshala|Himachal Pradesh|C
Himachal Pradesh University|Shimla|Himachal Pradesh|S
National Institute of Technology Hamirpur|Hamirpur|Himachal Pradesh|N
Jaypee University of Information Technology|Waknaghat|Himachal Pradesh|P
Shoolini University|Solan|Himachal Pradesh|P
Chitkara University Himachal Pradesh|Baddi|Himachal Pradesh|P
Eternal University|Baru Sahib|Himachal Pradesh|P
Maharaja Agrasen University|Baddi|Himachal Pradesh|P
Central University of Jammu|Jammu|Jammu and Kashmir|C
University of Jammu|Jammu|Jammu and Kashmir|S
Islamic University of Science and Technology|Awantipora|Jammu and Kashmir|S
National Institute of Technology Srinagar|Srinagar|Jammu and Kashmir|N
Baba Ghulam Shah Badshah University|Rajouri|Jammu and Kashmir|S
Cluster University of Srinagar|Srinagar|Jammu and Kashmir|S
Sher-e-Kashmir University of Agricultural Sciences and Technology of Jammu|Jammu|Jammu and Kashmir|S
Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir|Srinagar|Jammu and Kashmir|S
Dr. A.P.J. Abdul Kalam Technical University|Lucknow|Uttar Pradesh|S
Dr. Ram Manohar Lohia Avadh University|Ayodhya|Uttar Pradesh|S
Bundelkhand University|Jhansi|Uttar Pradesh|S
Chaudhary Charan Singh University|Meerut|Uttar Pradesh|S
Deen Dayal Upadhyaya Gorakhpur University|Gorakhpur|Uttar Pradesh|S
Gautam Buddha University|Greater Noida|Uttar Pradesh|S
IIMT University|Meerut|Uttar Pradesh|P
Teerthanker Mahaveer University|Moradabad|Uttar Pradesh|P
KIET Group of Institutions|Ghaziabad|Uttar Pradesh|O
Noida Institute of Engineering and Technology|Greater Noida|Uttar Pradesh|O
Ajay Kumar Garg Engineering College|Ghaziabad|Uttar Pradesh|O
Institute of Technology and Management Gorakhpur|Gorakhpur|Uttar Pradesh|O
Sanskriti University|Mathura|Uttar Pradesh|P
University of Allahabad|Prayagraj|Uttar Pradesh|C
Indian Institute of Management Lucknow|Lucknow|Uttar Pradesh|O
Maharshi Dayanand University|Rohtak|Haryana|S
Kurukshetra University|Kurukshetra|Haryana|S
Deenbandhu Chhotu Ram University of Science and Technology|Murthal|Haryana|S
National Institute of Technology Kurukshetra|Kurukshetra|Haryana|N
Manav Rachna International Institute of Research and Studies|Faridabad|Haryana|D
O.P. Jindal Global University|Sonipat|Haryana|P
Ashoka University|Sonipat|Haryana|P
World University of Design|Sonipat|Haryana|P
Central University of Haryana|Mahendragarh|Haryana|C
Indian Institute of Management Rohtak|Rohtak|Haryana|O
North Maharashtra University|Jalgaon|Maharashtra|S
Dr. Babasaheb Ambedkar Marathwada University|Chhatrapati Sambhajinagar|Maharashtra|S
Shivaji University|Kolhapur|Maharashtra|S
Sant Gadge Baba Amravati University|Amravati|Maharashtra|S
Rashtrasant Tukadoji Maharaj Nagpur University|Nagpur|Maharashtra|S
Yashwantrao Chavan Maharashtra Open University|Nashik|Maharashtra|S
Maharashtra Institute of Technology Aurangabad|Chhatrapati Sambhajinagar|Maharashtra|O
Walchand Institute of Technology|Solapur|Maharashtra|O
Government College of Engineering, Aurangabad|Chhatrapati Sambhajinagar|Maharashtra|O
Vishwakarma Institute of Technology|Pune|Maharashtra|O
Dr. D. Y. Patil Institute of Technology|Pune|Maharashtra|O
Pune Institute of Computer Technology|Pune|Maharashtra|O
Sardar Patel Institute of Technology|Mumbai|Maharashtra|O
Veermata Jijabai Technological Institute|Mumbai|Maharashtra|O
KLE Technological University|Hubballi|Karnataka|P
University of Mysore|Mysuru|Karnataka|S
Mangalore University|Mangaluru|Karnataka|S
Gulbarga University|Kalaburagi|Karnataka|S
Tumkur University|Tumakuru|Karnataka|S
Karnataka State Law University|Hubballi|Karnataka|S
National Law School of India University|Bengaluru|Karnataka|O
Indian Institute of Management Bangalore|Bengaluru|Karnataka|O
Indian Institute of Management Kozhikode|Kozhikode|Kerala|O
University of Kerala|Thiruvananthapuram|Kerala|S
Cochin University of Science and Technology|Kochi|Kerala|S
University of Calicut|Malappuram|Kerala|S
Mahatma Gandhi University, Kottayam|Kottayam|Kerala|S
Kerala University of Health Sciences|Thrissur|Kerala|S
National Institute of Technology Calicut|Kozhikode|Kerala|N
Amrita Vishwa Vidyapeetham|Coimbatore|Tamil Nadu|D
Tamil Nadu Agricultural University|Coimbatore|Tamil Nadu|S
Bharathiar University|Coimbatore|Tamil Nadu|S
Bharathidasan University|Tiruchirappalli|Tamil Nadu|S
Madurai Kamaraj University|Madurai|Tamil Nadu|S
Periyar University|Salem|Tamil Nadu|S
Annamalai University|Chidambaram|Tamil Nadu|S
Tamil Nadu Dr. M.G.R. Medical University|Chennai|Tamil Nadu|S
National Institute of Technology Tiruchirappalli|Tiruchirappalli|Tamil Nadu|N
Indian Institute of Management Tiruchirappalli|Tiruchirappalli|Tamil Nadu|O
Pondicherry University|Puducherry|Puducherry|C
Central University of Tamil Nadu|Thiruvarur|Tamil Nadu|C
National Institute of Technology Puducherry|Karaikal|Puducherry|N
Patna University|Patna|Bihar|S
National Institute of Technology Patna|Patna|Bihar|N
Central University of South Bihar|Gaya|Bihar|C
Babasaheb Bhimrao Ambedkar Bihar University|Muzaffarpur|Bihar|S
Ranchi University|Ranchi|Jharkhand|S
Birla Institute of Technology Mesra|Ranchi|Jharkhand|D
National Institute of Technology Jamshedpur|Jamshedpur|Jharkhand|N
Indian Institute of Management Ranchi|Ranchi|Jharkhand|O
Aryabhatta Knowledge University|Patna|Bihar|S
Nalanda University|Rajgir|Bihar|C
Chanakya National Law University|Patna|Bihar|O
Bihar Agricultural University|Sabour|Bihar|S
Magadh University|Bodh Gaya|Bihar|S
Veer Kunwar Singh University|Ara|Bihar|S
Purnea University|Purnia|Bihar|S
Lalit Narayan Mithila University|Darbhanga|Bihar|S
Amity University Jharkhand|Ranchi|Jharkhand|P
Central University of Jharkhand|Ranchi|Jharkhand|C
Kolhan University|Chaibasa|Jharkhand|S
Sido Kanhu Murmu University|Dumka|Jharkhand|S
Vinoba Bhave University|Hazaribagh|Jharkhand|S
XIM University|Bhubaneswar|Odisha|P
Odisha University of Technology and Research|Bhubaneswar|Odisha|S
Fakir Mohan University|Balasore|Odisha|S
Berhampur University|Berhampur|Odisha|S
Ravenshaw University|Cuttack|Odisha|S
Odisha University of Agriculture and Technology|Bhubaneswar|Odisha|S
Veer Surendra Sai University of Technology|Burla|Odisha|S
Sambalpur University|Sambalpur|Odisha|S
Kalinga Institute of Social Sciences|Bhubaneswar|Odisha|D
Maulana Abul Kalam Azad University of Technology|Haringhata|West Bengal|S
University of Kalyani|Kalyani|West Bengal|S
University of North Bengal|Siliguri|West Bengal|S
Presidency University, Kolkata|Kolkata|West Bengal|S
Rabindra Bharati University|Kolkata|West Bengal|S
Indian Institute of Management Calcutta|Kolkata|West Bengal|O
National Institute of Technology Durgapur|Durgapur|West Bengal|N
Indian Institute of Engineering Science and Technology Shibpur|Howrah|West Bengal|N
Adamas University|Barasat|West Bengal|P
Sister Nivedita University|Kolkata|West Bengal|P
Brainware University|Barasat|West Bengal|P
Amity University Kolkata|Kolkata|West Bengal|P
University of Engineering and Management Kolkata|Kolkata|West Bengal|P
Assam University|Silchar|Assam|C
National Institute of Technology Silchar|Silchar|Assam|N
Dibrugarh University|Dibrugarh|Assam|S
Assam Don Bosco University|Guwahati|Assam|P
Assam down town University|Guwahati|Assam|P
Cotton University|Guwahati|Assam|S
Royal Global University|Guwahati|Assam|P
North-Eastern Hill University|Shillong|Meghalaya|C
University of Science and Technology Meghalaya|Ri-Bhoi|Meghalaya|P
Martin Luther Christian University|Shillong|Meghalaya|P
Mizoram University|Aizawl|Mizoram|C
Tripura University|Agartala|Tripura|C
National Institute of Technology Agartala|Agartala|Tripura|N
Sikkim University|Gangtok|Sikkim|C
Banasthali Vidyapith|Banasthali|Rajasthan|D
Amity University Rajasthan|Jaipur|Rajasthan|P
Jagannath University|Jaipur|Rajasthan|P
JECRC University|Jaipur|Rajasthan|P
Poornima University|Jaipur|Rajasthan|P
Vivekananda Global University|Jaipur|Rajasthan|P
Suresh Gyan Vihar University|Jaipur|Rajasthan|P
Rajasthan Technical University|Kota|Rajasthan|S
Central University of Rajasthan|Ajmer|Rajasthan|C
Jodhpur National University|Jodhpur|Rajasthan|P
Amity University Gujarat|Ahmedabad|Gujarat|P
Charotar University of Science and Technology|Anand|Gujarat|P
Ganpat University|Mehsana|Gujarat|P
Gujarat Technological University|Ahmedabad|Gujarat|S
Dhirubhai Ambani Institute of Information and Communication Technology|Gandhinagar|Gujarat|D
Anand Agricultural University|Anand|Gujarat|S
Junagadh Agricultural University|Junagadh|Gujarat|S
Navsari Agricultural University|Navsari|Gujarat|S
Sardarkrushinagar Dantiwada Agricultural University|Banaskantha|Gujarat|S
Hemchandracharya North Gujarat University|Patan|Gujarat|S
Veer Narmad South Gujarat University|Surat|Gujarat|S
Kadi Sarva Vishwavidyalaya|Gandhinagar|Gujarat|P
Rai University|Ahmedabad|Gujarat|P
Silver Oak University|Ahmedabad|Gujarat|P
Ajeenkya D.Y. Patil University|Pune|Maharashtra|P
D.Y. Patil International University|Pune|Maharashtra|P
FLAME University|Pune|Maharashtra|P
Gokhale Institute of Politics and Economics|Pune|Maharashtra|D
Homi Bhabha National Institute|Mumbai|Maharashtra|D
SNDT Women's University|Mumbai|Maharashtra|S
Maharashtra National Law University Mumbai|Mumbai|Maharashtra|O
Maharashtra National Law University Nagpur|Nagpur|Maharashtra|O
Maharashtra National Law University Aurangabad|Chhatrapati Sambhajinagar|Maharashtra|O
MGM Institute of Health Sciences|Navi Mumbai|Maharashtra|D
Datta Meghe Institute of Higher Education and Research|Wardha|Maharashtra|D
Amity University Mumbai|Panvel|Maharashtra|P
Somaiya Vidyavihar University|Mumbai|Maharashtra|P
Atal Bihari Vajpayee Indian Institute of Information Technology and Management|Gwalior|Madhya Pradesh|N
Jiwaji University|Gwalior|Madhya Pradesh|S
Rani Durgavati Vishwavidyalaya|Jabalpur|Madhya Pradesh|S
Awadhesh Pratap Singh University|Rewa|Madhya Pradesh|S
Vikram University|Ujjain|Madhya Pradesh|S
Amity University Madhya Pradesh|Gwalior|Madhya Pradesh|P
Jagran Lakecity University|Bhopal|Madhya Pradesh|P
Medi-Caps University|Indore|Madhya Pradesh|P
Prestige Institute of Management and Research|Indore|Madhya Pradesh|O
Indian Institute of Management Indore|Indore|Madhya Pradesh|O
Central University of Punjab|Bathinda|Punjab|C
Punjabi University|Patiala|Punjab|S
Maharaja Ranjit Singh Punjab Technical University|Bathinda|Punjab|S
Punjab Agricultural University|Ludhiana|Punjab|S
Guru Angad Dev Veterinary and Animal Sciences University|Ludhiana|Punjab|S
Dr. B.R. Ambedkar National Institute of Technology|Jalandhar|Punjab|N
Indian Institute of Management Amritsar|Amritsar|Punjab|O
Sant Longowal Institute of Engineering and Technology|Longowal|Punjab|D
Rayat Bahra University|Mohali|Punjab|P
Guru Kashi University|Talwandi Sabo|Punjab|P
Akal University|Talwandi Sabo|Punjab|P
Desh Bhagat University|Mandi Gobindgarh|Punjab|P
CT University|Ludhiana|Punjab|P
GNA University|Phagwara|Punjab|P
DAV University|Jalandhar|Punjab|P
Maharishi Markandeshwar University|Mullana|Haryana|D
Amity University Haryana|Gurugram|Haryana|P
Sushant University|Gurugram|Haryana|P
GD Goenka University|Gurugram|Haryana|P
The NorthCap University|Gurugram|Haryana|P
SRM University Delhi-NCR|Sonipat|Haryana|P
Ch. Devi Lal University|Sirsa|Haryana|S
Shree Guru Gobind Singh Tricentenary University|Gurugram|Haryana|P
Swami Vivekanand Subharti University|Meerut|Uttar Pradesh|P
Shobhit University|Meerut|Uttar Pradesh|D
Noida International University|Greater Noida|Uttar Pradesh|P
Galgotias College of Engineering and Technology|Greater Noida|Uttar Pradesh|O
Greater Noida Institute of Technology|Greater Noida|Uttar Pradesh|O
Accurate Institute of Management and Technology|Greater Noida|Uttar Pradesh|O
IIMT College of Engineering|Greater Noida|Uttar Pradesh|O
R.D. Engineering College|Ghaziabad|Uttar Pradesh|O
ABES Engineering College|Ghaziabad|Uttar Pradesh|O
Raj Kumar Goel Institute of Technology|Ghaziabad|Uttar Pradesh|O
United Institute of Technology|Prayagraj|Uttar Pradesh|O
Institute of Engineering and Technology Lucknow|Lucknow|Uttar Pradesh|O
Babu Banarasi Das University|Lucknow|Uttar Pradesh|P
Integral University|Lucknow|Uttar Pradesh|P
Dr. Shakuntala Misra National Rehabilitation University|Lucknow|Uttar Pradesh|S
Amity University Lucknow Campus|Lucknow|Uttar Pradesh|P
Dayalbagh Educational Institute|Agra|Uttar Pradesh|D
Dr. Bhimrao Ambedkar University|Agra|Uttar Pradesh|S
Chhatrapati Shahu Ji Maharaj University|Kanpur|Uttar Pradesh|S
Graphic Era Hill University|Dehradun|Uttarakhand|P
Dev Bhoomi Uttarakhand University|Dehradun|Uttarakhand|P
Himalayan Institute of Technology|Dehradun|Uttarakhand|O
Motherhood University|Roorkee|Uttarakhand|P
University of Engineering and Management Jaipur|Jaipur|Rajasthan|P
Arya College of Engineering and IT|Jaipur|Rajasthan|O
Rajasthan College of Engineering for Women|Jaipur|Rajasthan|O
Swami Keshvanand Institute of Technology|Jaipur|Rajasthan|O
MBM University|Jodhpur|Rajasthan|S
J.K. Lakshmipat University|Jaipur|Rajasthan|P
Sir Padampat Singhania University|Udaipur|Rajasthan|P
Pacific University|Udaipur|Rajasthan|P
University of Rajasthan, College of Engineering and Technology|Jaipur|Rajasthan|O
Rajasthan University of Veterinary and Animal Sciences|Bikaner|Rajasthan|S
GLS University|Ahmedabad|Gujarat|P
Parul University|Vadodara|Gujarat|P
ITM Vocational University|Vadodara|Gujarat|P
Uka Tarsadia University|Bardoli|Gujarat|P
Indus University|Ahmedabad|Gujarat|P
Ahmedabad Institute of Technology|Ahmedabad|Gujarat|O
L.J. Institute of Engineering and Technology|Ahmedabad|Gujarat|O
SAL Institute of Technology and Engineering Research|Ahmedabad|Gujarat|O
Darshan University|Rajkot|Gujarat|P
D.Y. Patil University|Navi Mumbai|Maharashtra|D
Dr. D.Y. Patil Vidyapeeth|Pune|Maharashtra|D
A.P. Shah Institute of Technology|Thane|Maharashtra|O
Thakur College of Engineering and Technology|Mumbai|Maharashtra|O
Fr. Conceicao Rodrigues College of Engineering|Mumbai|Maharashtra|O
CMR University|Bengaluru|Karnataka|P
Presidency University, Bengaluru|Bengaluru|Karnataka|P
Alliance University|Bengaluru|Karnataka|P
Acharya Institute of Technology|Bengaluru|Karnataka|O
Reva University|Bengaluru|Karnataka|P
Dayananda Sagar University|Bengaluru|Karnataka|P
Bengaluru North University|Kolar|Karnataka|S
Karnataka University|Dharwad|Karnataka|S
Rajiv Gandhi University of Health Sciences|Bengaluru|Karnataka|S
Karnataka State Open University|Mysuru|Karnataka|S
Telangana University|Nizamabad|Telangana|S
Mahatma Gandhi University, Nalgonda|Nalgonda|Telangana|S
Anurag University|Hyderabad|Telangana|P
Malla Reddy University|Hyderabad|Telangana|P
Woxsen University|Hyderabad|Telangana|P
ICFAI Foundation for Higher Education|Hyderabad|Telangana|D
Chaitanya Bharathi Institute of Technology|Hyderabad|Telangana|O
Vasavi College of Engineering|Hyderabad|Telangana|O
Gokaraju Rangaraju Institute of Engineering and Technology|Hyderabad|Telangana|O
Sreenidhi Institute of Science and Technology|Hyderabad|Telangana|O
Vardhaman College of Engineering|Hyderabad|Telangana|O
CVR College of Engineering|Hyderabad|Telangana|O
BVRIT Hyderabad College of Engineering for Women|Hyderabad|Telangana|O
Mahatma Gandhi Institute of Technology|Hyderabad|Telangana|O
JNTU University College of Engineering Hyderabad|Hyderabad|Telangana|O
PSG College of Technology|Coimbatore|Tamil Nadu|O
Thiagarajar College of Engineering|Madurai|Tamil Nadu|O
Government College of Technology, Coimbatore|Coimbatore|Tamil Nadu|O
Erode Sengunthar Engineering College|Erode|Tamil Nadu|O
Dr. Mahalingam College of Engineering and Technology|Pollachi|Tamil Nadu|O
Mepco Schlenk Engineering College|Sivakasi|Tamil Nadu|O
National Engineering College|Kovilpatti|Tamil Nadu|O
Velammal Engineering College|Chennai|Tamil Nadu|O
Easwari Engineering College|Chennai|Tamil Nadu|O
Sri Sairam Engineering College|Chennai|Tamil Nadu|O
Panimalar Engineering College|Chennai|Tamil Nadu|O
St. Joseph's College of Engineering|Chennai|Tamil Nadu|O
Chennai Institute of Technology|Chennai|Tamil Nadu|O
Rajalakshmi Engineering College|Chennai|Tamil Nadu|O
Saveetha Engineering College|Chennai|Tamil Nadu|O
KCG College of Technology|Chennai|Tamil Nadu|O
Sri Krishna College of Engineering and Technology|Coimbatore|Tamil Nadu|O
Kumaraguru College of Technology|Coimbatore|Tamil Nadu|O
Bannari Amman Institute of Technology|Sathyamangalam|Tamil Nadu|O
Kongu Engineering College|Perundurai|Tamil Nadu|O
Sri Ramakrishna Engineering College|Coimbatore|Tamil Nadu|O
Karpagam College of Engineering|Coimbatore|Tamil Nadu|O
Adhiyamaan College of Engineering|Hosur|Tamil Nadu|O
Government College of Engineering, Salem|Salem|Tamil Nadu|O
Government College of Engineering, Tirunelveli|Tirunelveli|Tamil Nadu|O
Government Engineering College, Thrissur|Thrissur|Kerala|O
TKM College of Engineering|Kollam|Kerala|O
Rajagiri School of Engineering and Technology|Kochi|Kerala|O
Model Engineering College|Kochi|Kerala|O
College of Engineering Trivandrum|Thiruvananthapuram|Kerala|O
Mar Athanasius College of Engineering|Kothamangalam|Kerala|O
Federal Institute of Science and Technology|Angamaly|Kerala|O
Amal Jyothi College of Engineering|Kanjirappally|Kerala|O
Saintgits College of Engineering|Kottayam|Kerala|O
College of Engineering Chengannur|Chengannur|Kerala|O
Government Engineering College, Barton Hill|Thiruvananthapuram|Kerala|O
NSS College of Engineering|Palakkad|Kerala|O
A.P. Engineering College|Vijayawada|Andhra Pradesh|O
RVR & JC College of Engineering|Guntur|Andhra Pradesh|O
Prasad V. Potluri Siddhartha Institute of Technology|Vijayawada|Andhra Pradesh|O
Andhra Loyola Institute of Engineering and Technology|Vijayawada|Andhra Pradesh|O
Sagi Ramakrishnam Raju Engineering College|Bhimavaram|Andhra Pradesh|O
Gayatri Vidya Parishad College of Engineering|Visakhapatnam|Andhra Pradesh|O
Anil Neerukonda Institute of Technology and Sciences|Visakhapatnam|Andhra Pradesh|O
Aditya Engineering College|Surampalem|Andhra Pradesh|O
JNTU College of Engineering Anantapur|Anantapur|Andhra Pradesh|O
JNTU College of Engineering Kakinada|Kakinada|Andhra Pradesh|O
G. Pulla Reddy Engineering College|Kurnool|Andhra Pradesh|O
Sri Venkateswara College of Engineering|Tirupati|Andhra Pradesh|O
Rajeev Gandhi Memorial College of Engineering and Technology|Nandyal|Andhra Pradesh|O
B.V. Bhoomaraddi College of Engineering and Technology|Hubballi|Karnataka|O
KLE Society's S. Nijalingappa College|Bengaluru|Karnataka|O
Sir M. Visvesvaraya Institute of Technology|Bengaluru|Karnataka|O
University Visvesvaraya College of Engineering|Bengaluru|Karnataka|O
B.N.M. Institute of Technology|Bengaluru|Karnataka|O
RNS Institute of Technology|Bengaluru|Karnataka|O
Sambhram Institute of Technology|Bengaluru|Karnataka|O
Atria Institute of Technology|Bengaluru|Karnataka|O
East West Institute of Technology|Bengaluru|Karnataka|O
N.M.A.M. Institute of Technology|Nitte|Karnataka|O
Canara Engineering College|Mangaluru|Karnataka|O
Sahyadri College of Engineering and Management|Mangaluru|Karnataka|O
St. Joseph Engineering College|Mangaluru|Karnataka|O
Jain College of Engineering|Belagavi|Karnataka|O
KLS Gogte Institute of Technology|Belagavi|Karnataka|O
Basaveshwar Engineering College|Bagalkot|Karnataka|O
SDM College of Engineering and Technology|Dharwad|Karnataka|O
Hirasugar Institute of Technology|Nidasoshi|Karnataka|O
Bapuji Institute of Engineering and Technology|Davangere|Karnataka|O
JSS Science and Technology University|Mysuru|Karnataka|P
Vidyavardhaka College of Engineering|Mysuru|Karnataka|O
The National Institute of Engineering|Mysuru|Karnataka|O
Malnad College of Engineering|Hassan|Karnataka|O
PES College of Engineering|Mandya|Karnataka|O
A.M.C. Engineering College|Bengaluru|Karnataka|O
Heritage Institute of Technology|Kolkata|West Bengal|O
Institute of Engineering and Management|Kolkata|West Bengal|O
JIS College of Engineering|Kalyani|West Bengal|O
Haldia Institute of Technology|Haldia|West Bengal|O
Narula Institute of Technology|Kolkata|West Bengal|O
Kalyani Government Engineering College|Kalyani|West Bengal|O
Cooch Behar Government Engineering College|Cooch Behar|West Bengal|O
Jalpaiguri Government Engineering College|Jalpaiguri|West Bengal|O
Assam Engineering College|Guwahati|Assam|O
Jorhat Engineering College|Jorhat|Assam|O
Tezpur Medical College and Hospital|Tezpur|Assam|O
Assam Medical College|Dibrugarh|Assam|O
Gauhati Medical College|Guwahati|Assam|O
North Eastern Regional Institute of Science and Technology|Nirjuli|Arunachal Pradesh|D
Rajiv Gandhi University|Itanagar|Arunachal Pradesh|C
National Institute of Technology Meghalaya|Shillong|Meghalaya|N
National Institute of Technology Manipur|Imphal|Manipur|N
Manipur University|Imphal|Manipur|C
National Institute of Technology Mizoram|Aizawl|Mizoram|N
National Institute of Technology Nagaland|Dimapur|Nagaland|N
Nagaland University|Lumami|Nagaland|C
National Institute of Technology Sikkim|Ravangla|Sikkim|N
National Institute of Technology Arunachal Pradesh|Yupia|Arunachal Pradesh|N
All India Institute of Medical Sciences New Delhi|New Delhi|Delhi|N
AIIMS Jodhpur|Jodhpur|Rajasthan|N
AIIMS Bhopal|Bhopal|Madhya Pradesh|N
AIIMS Bhubaneswar|Bhubaneswar|Odisha|N
AIIMS Patna|Patna|Bihar|N
AIIMS Rishikesh|Rishikesh|Uttarakhand|N
AIIMS Raipur|Raipur|Chhattisgarh|N
Christian Medical College|Vellore|Tamil Nadu|O
Kasturba Medical College, Manipal|Manipal|Karnataka|O
Kasturba Medical College, Mangaluru|Mangaluru|Karnataka|O
St. John's Medical College|Bengaluru|Karnataka|O
Maulana Azad Medical College|New Delhi|Delhi|O
Lady Hardinge Medical College|New Delhi|Delhi|O
Armed Forces Medical College|Pune|Maharashtra|O
Seth GS Medical College|Mumbai|Maharashtra|O
Institute of Medical Sciences, BHU|Varanasi|Uttar Pradesh|O
Madras Medical College|Chennai|Tamil Nadu|O
Government Medical College and Hospital, Chandigarh|Chandigarh|Chandigarh|O
JIPMER|Puducherry|Puducherry|N
Indian Institute of Management Ahmedabad|Ahmedabad|Gujarat|O
Indian Institute of Management Mumbai|Mumbai|Maharashtra|O
Indian Institute of Management Shillong|Shillong|Meghalaya|O
Indian Institute of Management Udaipur|Udaipur|Rajasthan|O
Indian Institute of Management Kashipur|Kashipur|Uttarakhand|O
Indian Institute of Management Raipur|Raipur|Chhattisgarh|O
Indian Institute of Management Nagpur|Nagpur|Maharashtra|O
Indian Institute of Management Visakhapatnam|Visakhapatnam|Andhra Pradesh|O
Indian Institute of Management Bodh Gaya|Bodh Gaya|Bihar|O
Indian Institute of Management Jammu|Jammu|Jammu and Kashmir|O
Indian Institute of Management Sambalpur|Sambalpur|Odisha|O
XLRI - Xavier School of Management|Jamshedpur|Jharkhand|O
SP Jain Institute of Management and Research|Mumbai|Maharashtra|O
Management Development Institute|Gurugram|Haryana|O
Narsee Monjee Institute of Management Studies|Mumbai|Maharashtra|D
Indian Institute of Foreign Trade|New Delhi|Delhi|D
National Law University Delhi|New Delhi|Delhi|O
National Law University Jodhpur|Jodhpur|Rajasthan|O
NALSAR University of Law|Hyderabad|Telangana|O
Gujarat National Law University|Gandhinagar|Gujarat|O
National Law Institute University|Bhopal|Madhya Pradesh|O
West Bengal National University of Juridical Sciences|Kolkata|West Bengal|O
Hidayatullah National Law University|Raipur|Chhattisgarh|O
National University of Advanced Legal Studies|Kochi|Kerala|O
Rajiv Gandhi National University of Law|Patiala|Punjab|O
National Law University Odisha|Cuttack|Odisha|O
National Law University and Judicial Academy Assam|Guwahati|Assam|O
Tamil Nadu National Law University|Tiruchirappalli|Tamil Nadu|O
Himachal Pradesh National Law University|Shimla|Himachal Pradesh|O
Dr. Ram Manohar Lohiya National Law University|Lucknow|Uttar Pradesh|O
National Law University Tripura|Agartala|Tripura|O
Ambedkar University Delhi|Delhi|Delhi|S
Indian Agricultural Research Institute|New Delhi|Delhi|D
Indian Veterinary Research Institute|Izatnagar|Uttar Pradesh|D
Govind Ballabh Pant University of Agriculture and Technology|Pantnagar|Uttarakhand|S
Chaudhary Charan Singh Haryana Agricultural University|Hisar|Haryana|S
Dr. Y.S. Parmar University of Horticulture and Forestry|Nauni|Himachal Pradesh|S
Jawaharlal Nehru Krishi Vishwa Vidyalaya|Jabalpur|Madhya Pradesh|S
Indira Gandhi Krishi Vishwavidyalaya|Raipur|Chhattisgarh|S
Rajendra Prasad Central Agricultural University|Pusa|Bihar|C
Assam Agricultural University|Jorhat|Assam|S
Acharya N.G. Ranga Agricultural University|Guntur|Andhra Pradesh|S
Professor Jayashankar Telangana State Agricultural University|Hyderabad|Telangana|S
Kerala Agricultural University|Thrissur|Kerala|S
University of Agricultural Sciences, Bengaluru|Bengaluru|Karnataka|S
University of Agricultural Sciences, Dharwad|Dharwad|Karnataka|S
Maharashtra Animal and Fishery Sciences University|Nagpur|Maharashtra|S
West Bengal University of Animal and Fishery Sciences|Kolkata|West Bengal|S
National Institute of Pharmaceutical Education and Research Mohali|Mohali|Punjab|N
NIPER Hyderabad|Hyderabad|Telangana|N
NIPER Ahmedabad|Ahmedabad|Gujarat|N
NIPER Kolkata|Kolkata|West Bengal|N
NIPER Guwahati|Guwahati|Assam|N
NIPER Raebareli|Raebareli|Uttar Pradesh|N
National Institute of Design Ahmedabad|Ahmedabad|Gujarat|N
National Institute of Design Bengaluru|Bengaluru|Karnataka|O
National Institute of Design Gandhinagar|Gandhinagar|Gujarat|O
National Institute of Fashion Technology New Delhi|New Delhi|Delhi|N
NIFT Mumbai|Mumbai|Maharashtra|O
NIFT Bengaluru|Bengaluru|Karnataka|O
NIFT Chennai|Chennai|Tamil Nadu|O
NIFT Hyderabad|Hyderabad|Telangana|O
NIFT Kolkata|Kolkata|West Bengal|O
NIFT Gandhinagar|Gandhinagar|Gujarat|O
NITTTR Chandigarh|Chandigarh|Chandigarh|O
NITTTR Bhopal|Bhopal|Madhya Pradesh|O
NITTTR Chennai|Chennai|Tamil Nadu|O
NITTTR Kolkata|Kolkata|West Bengal|O
Indian Institute of Information Technology Allahabad|Prayagraj|Uttar Pradesh|N
Indian Institute of Information Technology Gwalior|Gwalior|Madhya Pradesh|N
Indian Institute of Information Technology Jabalpur|Jabalpur|Madhya Pradesh|N
Indian Institute of Information Technology Kancheepuram|Chennai|Tamil Nadu|N
Indian Institute of Information Technology Kota|Kota|Rajasthan|N
Indian Institute of Information Technology Sri City|Chittoor|Andhra Pradesh|N
Indian Institute of Information Technology Vadodara|Gandhinagar|Gujarat|N
Indian Institute of Information Technology Pune|Pune|Maharashtra|N
Indian Institute of Information Technology Nagpur|Nagpur|Maharashtra|N
Indian Institute of Information Technology Kalyani|Kalyani|West Bengal|N
Indian Institute of Information Technology Una|Una|Himachal Pradesh|N
Indian Institute of Information Technology Dharwad|Dharwad|Karnataka|N
Indian Institute of Information Technology Tiruchirappalli|Tiruchirappalli|Tamil Nadu|N
Indian Institute of Information Technology Lucknow|Lucknow|Uttar Pradesh|N
Indian Institute of Information Technology Ranchi|Ranchi|Jharkhand|N
Indian Institute of Information Technology Bhagalpur|Bhagalpur|Bihar|N
Indian Institute of Information Technology Bhopal|Bhopal|Madhya Pradesh|N
Indian Institute of Information Technology Surat|Surat|Gujarat|N
Indian Institute of Information Technology Manipur|Imphal|Manipur|N
Indian Institute of Information Technology Sonepat|Sonipat|Haryana|N
Indian Institute of Information Technology Agartala|Agartala|Tripura|N
Indian Institute of Information Technology Raichur|Raichur|Karnataka|N
Indian Institute of Information Technology Kottayam|Kottayam|Kerala|N
Indian Institute of Information Technology Guwahati|Guwahati|Assam|N
Indian Institute of Information Technology Design and Manufacturing Kurnool|Kurnool|Andhra Pradesh|N
Shri Ram College of Commerce|New Delhi|Delhi|O
Hindu College|New Delhi|Delhi|O
St. Stephen's College|New Delhi|Delhi|O
Lady Shri Ram College for Women|New Delhi|Delhi|O
Hansraj College|New Delhi|Delhi|O
Kirori Mal College|New Delhi|Delhi|O
Miranda House|New Delhi|Delhi|O
Ramjas College|New Delhi|Delhi|O
Sri Venkateswara College|New Delhi|Delhi|O
Jesus and Mary College|New Delhi|Delhi|O
Christ College, Irinjalakuda|Irinjalakuda|Kerala|O
Loyola College|Chennai|Tamil Nadu|O
Presidency College, Chennai|Chennai|Tamil Nadu|O
Madras Christian College|Chennai|Tamil Nadu|O
Stella Maris College|Chennai|Tamil Nadu|O
Ethiraj College for Women|Chennai|Tamil Nadu|O
PSG College of Arts and Science|Coimbatore|Tamil Nadu|O
St. Xavier's College, Mumbai|Mumbai|Maharashtra|O
Hinduja College of Commerce|Mumbai|Maharashtra|O
Mithibai College|Mumbai|Maharashtra|O
Jai Hind College|Mumbai|Maharashtra|O
Fergusson College|Pune|Maharashtra|O
Symbiosis College of Arts and Commerce|Pune|Maharashtra|O
St. Xavier's College, Kolkata|Kolkata|West Bengal|O
Scottish Church College|Kolkata|West Bengal|O
School of Planning and Architecture Delhi|New Delhi|Delhi|N
School of Planning and Architecture Bhopal|Bhopal|Madhya Pradesh|N
School of Planning and Architecture Vijayawada|Vijayawada|Andhra Pradesh|N
Sir J.J. College of Architecture|Mumbai|Maharashtra|O
CEPT University|Ahmedabad|Gujarat|P
Chandigarh College of Architecture|Chandigarh|Chandigarh|O
Bengal Institute of Technology|Kolkata|West Bengal|O
Indian Institute of Science Education and Research Pune|Pune|Maharashtra|N
Indian Institute of Science Education and Research Kolkata|Nadia|West Bengal|N
Indian Institute of Science Education and Research Mohali|Mohali|Punjab|N
Indian Institute of Science Education and Research Bhopal|Bhopal|Madhya Pradesh|N
Indian Institute of Science Education and Research Thiruvananthapuram|Thiruvananthapuram|Kerala|N
Indian Institute of Science Education and Research Tirupati|Tirupati|Andhra Pradesh|N
Indian Institute of Science Education and Research Berhampur|Berhampur|Odisha|N
National Institute of Technology Goa|Ponda|Goa|N
Goa University|Taleigao|Goa|S
Don Bosco College of Engineering|Fatorda|Goa|O
Goa College of Engineering|Farmagudi|Goa|O
Dhempe College of Arts and Science|Panaji|Goa|O
National Institute of Technology Raipur|Raipur|Chhattisgarh|N
Indian Institute of Technology Bhilai|Bhilai|Chhattisgarh|N
Chhattisgarh Swami Vivekanand Technical University|Bhilai|Chhattisgarh|S
Guru Ghasidas Vishwavidyalaya|Bilaspur|Chhattisgarh|C
Amity University Chhattisgarh|Raipur|Chhattisgarh|P
Atal Bihari Vajpayee University|Bilaspur|Chhattisgarh|S
Kalinga University|Raipur|Chhattisgarh|P
MATS University|Raipur|Chhattisgarh|P
ISBM University|Gariyaband|Chhattisgarh|P
Dr. C.V. Raman University|Bilaspur|Chhattisgarh|P
Indira Kala Sangeet Vishwavidyalaya|Khairagarh|Chhattisgarh|S
National Institute of Technology Karnataka|Surathkal|Karnataka|N
National Institute of Technology Warangal|Warangal|Telangana|N
National Institute of Technology Andhra Pradesh|Tadepalligudem|Andhra Pradesh|N
Central University of Andhra Pradesh|Anantapur|Andhra Pradesh|C
Central University of Kerala|Kasaragod|Kerala|C
Central University of Karnataka|Kalaburagi|Karnataka|C
Central University of Gujarat|Gandhinagar|Gujarat|C
Central University of Odisha|Koraput|Odisha|C
Central University of Kashmir|Ganderbal|Jammu and Kashmir|C
DAV College, Chandigarh|Chandigarh|Chandigarh|O
Government College for Girls, Chandigarh|Chandigarh|Chandigarh|O
Indian Institute of Technology Mandi|Mandi|Himachal Pradesh|N
Jai Narain Vyas University|Jodhpur|Rajasthan|S
Malaviya National Institute of Technology Jaipur|Jaipur|Rajasthan|N
Sardar Patel University|Vallabh Vidyanagar|Gujarat|S
Saurashtra University|Rajkot|Gujarat|S
Maulana Azad National Institute of Technology|Bhopal|Madhya Pradesh|N
Visvesvaraya National Institute of Technology|Nagpur|Maharashtra|N
Goa Institute of Management|Sanquelim|Goa|O
Bengaluru City University|Bengaluru|Karnataka|S
Bangalore University|Bengaluru|Karnataka|S
Ramaiah University of Applied Sciences|Bengaluru|Karnataka|P
Alagappa University|Karaikudi|Tamil Nadu|S
Indian Institute of Technology Palakkad|Palakkad|Kerala|N
Harvard University|Cambridge|Massachusetts|F|US
Massachusetts Institute of Technology|Cambridge|Massachusetts|F|US
Stanford University|Stanford|California|F|US
California Institute of Technology|Pasadena|California|F|US
University of California, Berkeley|Berkeley|California|F|US
University of California, Los Angeles|Los Angeles|California|F|US
University of California, San Diego|San Diego|California|F|US
University of Southern California|Los Angeles|California|F|US
Carnegie Mellon University|Pittsburgh|Pennsylvania|F|US
University of Pennsylvania|Philadelphia|Pennsylvania|F|US
Princeton University|Princeton|New Jersey|F|US
Yale University|New Haven|Connecticut|F|US
Columbia University|New York City|New York|F|US
Cornell University|Ithaca|New York|F|US
New York University|New York City|New York|F|US
University of Chicago|Chicago|Illinois|F|US
Northwestern University|Evanston|Illinois|F|US
University of Illinois Urbana-Champaign|Urbana-Champaign|Illinois|F|US
University of Michigan|Ann Arbor|Michigan|F|US
Purdue University|West Lafayette|Indiana|F|US
Georgia Institute of Technology|Atlanta|Georgia|F|US
University of Texas at Austin|Austin|Texas|F|US
Rice University|Houston|Texas|F|US
University of Washington|Seattle|Washington|F|US
Duke University|Durham|North Carolina|F|US
University of Oxford|Oxford|England|F|GB
University of Cambridge|Cambridge|England|F|GB
Imperial College London|London|England|F|GB
University College London|London|England|F|GB
King's College London|London|England|F|GB
London School of Economics and Political Science|London|England|F|GB
University of Edinburgh|Edinburgh|Scotland|F|GB
University of Glasgow|Glasgow|Scotland|F|GB
University of Manchester|Manchester|England|F|GB
University of Warwick|Coventry|England|F|GB
University of Bristol|Bristol|England|F|GB
University of Birmingham|Birmingham|England|F|GB
University of Leeds|Leeds|England|F|GB
University of Sheffield|Sheffield|England|F|GB
University of Nottingham|Nottingham|England|F|GB
University of Southampton|Southampton|England|F|GB
University of Liverpool|Liverpool|England|F|GB
Durham University|Durham|England|F|GB
University of York|York|England|F|GB
Queen Mary University of London|London|England|F|GB
University of Exeter|Exeter|England|F|GB
University of Bath|Bath|England|F|GB
Cardiff University|Cardiff|Wales|F|GB
Queen's University Belfast|Belfast|Northern Ireland|F|GB
University of St Andrews|St Andrews|Scotland|F|GB
University of Toronto|Toronto|Ontario|F|CA
University of British Columbia|Vancouver|British Columbia|F|CA
McGill University|Montreal|Quebec|F|CA
University of Waterloo|Waterloo|Ontario|F|CA
University of Alberta|Edmonton|Alberta|F|CA
McMaster University|Hamilton|Ontario|F|CA
University of Montreal|Montreal|Quebec|F|CA
University of Ottawa|Ottawa|Ontario|F|CA
University of Calgary|Calgary|Alberta|F|CA
Queen's University|Kingston|Ontario|F|CA
Simon Fraser University|Burnaby|British Columbia|F|CA
University of Manitoba|Winnipeg|Manitoba|F|CA
Dalhousie University|Halifax|Nova Scotia|F|CA
University of Victoria|Victoria|British Columbia|F|CA
University of Sydney|Sydney|New South Wales|F|AU
University of Melbourne|Melbourne|Victoria|F|AU
Australian National University|Canberra|Australian Capital Territory|F|AU
Monash University|Melbourne|Victoria|F|AU
University of Queensland|Brisbane|Queensland|F|AU
University of New South Wales|Sydney|New South Wales|F|AU
University of Western Australia|Perth|Western Australia|F|AU
University of Adelaide|Adelaide|South Australia|F|AU
Queensland University of Technology|Brisbane|Queensland|F|AU
RMIT University|Melbourne|Victoria|F|AU
University of Tasmania|Hobart|Tasmania|F|AU
Curtin University|Perth|Western Australia|F|AU
University of Auckland|Auckland||F|NZ
University of Otago|Dunedin||F|NZ
Victoria University of Wellington|Wellington||F|NZ
University of Canterbury|Christchurch||F|NZ
Auckland University of Technology|Auckland||F|NZ
University of Waikato|Hamilton||F|NZ
ETH Zurich|Zurich||F|CH
EPFL|Lausanne||F|CH
University of Zurich|Zurich||F|CH
University of Geneva|Geneva||F|CH
Technical University of Munich|Munich||F|DE
Ludwig Maximilian University of Munich|Munich||F|DE
Heidelberg University|Heidelberg||F|DE
RWTH Aachen University|Aachen||F|DE
University of Amsterdam|Amsterdam||F|NL
Delft University of Technology|Delft||F|NL
Leiden University|Leiden||F|NL
KU Leuven|Leuven||F|BE
Sorbonne University|Paris||F|FR
École Polytechnique|Palaiseau||F|FR
University of Copenhagen|Copenhagen||F|DK
National University of Singapore|Singapore||F|SG
Nanyang Technological University|Singapore||F|SG
University of Tokyo|Tokyo||F|JP
Kyoto University|Kyoto||F|JP
Osaka University|Osaka||F|JP
Tohoku University|Sendai||F|JP
Tokyo Institute of Technology|Tokyo||F|JP
Waseda University|Tokyo||F|JP
Keio University|Tokyo||F|JP
Seoul National University|Seoul||F|KR
KAIST|Daejeon||F|KR
Yonsei University|Seoul||F|KR
Korea University|Seoul||F|KR
Hanyang University|Seoul||F|KR
Tsinghua University|Beijing||F|CN
Peking University|Beijing||F|CN
Fudan University|Shanghai||F|CN
Shanghai Jiao Tong University|Shanghai||F|CN
Zhejiang University|Hangzhou||F|CN
University of Science and Technology of China|Hefei||F|CN
University of Chinese Academy of Sciences|Beijing||F|CN
Hong Kong University of Science and Technology|Hong Kong||F|HK
University of Hong Kong|Hong Kong||F|HK
Hong Kong Polytechnic University|Hong Kong||F|HK
Chinese University of Hong Kong|Hong Kong||F|HK
City University of Hong Kong|Hong Kong||F|HK
National Taiwan University|Taipei||F|TW
National Tsing Hua University|Hsinchu||F|TW
National Yang Ming Chiao Tung University|Hsinchu||F|TW
University of Malaya|Kuala Lumpur||F|MY
Universiti Teknologi Malaysia|Johor Bahru||F|MY
Universiti Putra Malaysia|Serdang||F|MY
Chulalongkorn University|Bangkok||F|TH
Mahidol University|Nakhon Pathom||F|TH
University of the Philippines Diliman|Quezon City||F|PH
University of Helsinki|Helsinki||F|FI
Aalto University|Espoo||F|FI
KTH Royal Institute of Technology|Stockholm||F|SE
Lund University|Lund||F|SE
Uppsala University|Uppsala||F|SE
University of Oslo|Oslo||F|NO
Norwegian University of Science and Technology|Trondheim||F|NO
University of Iceland|Reykjavik||F|IS
University of Warsaw|Warsaw||F|PL
Jagiellonian University|Kraków||F|PL
Charles University|Prague||F|CZ
Czech Technical University in Prague|Prague||F|CZ
University of Vienna|Vienna||F|AT
Vienna University of Technology|Vienna||F|AT
University of Barcelona|Barcelona||F|ES
Autonomous University of Barcelona|Barcelona||F|ES
Complutense University of Madrid|Madrid||F|ES
University of Bologna|Bologna||F|IT
Sapienza University of Rome|Rome||F|IT
Politecnico di Milano|Milan||F|IT
University of Pisa|Pisa||F|IT
Trinity College Dublin|Dublin||F|IE
University College Dublin|Dublin||F|IE
University of Lisbon|Lisbon||F|PT
University of Porto|Porto||F|PT
University of Cape Town|Cape Town||F|ZA
University of the Witwatersrand|Johannesburg||F|ZA
Stellenbosch University|Stellenbosch||F|ZA
University of Pretoria|Pretoria||F|ZA
University of Johannesburg|Johannesburg||F|ZA
Cairo University|Giza||F|EG
American University in Cairo|Cairo||F|EG
Ain Shams University|Cairo||F|EG
University of Nairobi|Nairobi||F|KE
Kenyatta University|Nairobi||F|KE
University of Ghana|Accra||F|GH
Kwame Nkrumah University of Science and Technology|Kumasi||F|GH
University of Lagos|Lagos||F|NG
University of Ibadan|Ibadan||F|NG
Ahmadu Bello University|Zaria||F|NG
University of Rwanda|Kigali||F|RW
Addis Ababa University|Addis Ababa||F|ET
University of Dar es Salaam|Dar es Salaam||F|TZ
University of Tunis|Tunis||F|TN
Mohammed V University|Rabat||F|MA
King Saud University|Riyadh||F|SA
King Abdulaziz University|Jeddah||F|SA
Qatar University|Doha||F|QA
United Arab Emirates University|Al Ain||F|AE
American University of Beirut|Beirut||F|LB
University of São Paulo|São Paulo||F|BR
State University of Campinas|Campinas||F|BR
Federal University of Rio de Janeiro|Rio de Janeiro||F|BR
Pontifical Catholic University of Chile|Santiago||F|CL
University of Chile|Santiago||F|CL
National Autonomous University of Mexico|Mexico City||F|MX
Monterrey Institute of Technology|Monterrey||F|MX
University of Buenos Aires|Buenos Aires||F|AR
University of the Andes, Colombia|Bogotá||F|CO
National University of Colombia|Bogotá||F|CO
University of Costa Rica|San José||F|CR
University of Havana|Havana||F|CU
University of the West Indies, Mona|Mona||F|JM
University of the West Indies, St. Augustine|St. Augustine||F|TT
University of the West Indies, Cave Hill|Cave Hill||F|BB
University of Puerto Rico, Río Piedras|San Juan||F|PR
University of the Andes, Venezuela|Mérida||F|VE
`;
