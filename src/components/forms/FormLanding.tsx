import * as yup from 'yup';
import { useCallback, useEffect, useState } from "react";
import CustomInput from "../inputs/CustomInput";
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import DateInput from '../inputs/CustomInputDate';
import { saveEmail, saveLead, saveNumberLead } from '../../services/localStorage';
import { FaRegPaperPlane } from "react-icons/fa";
import CustomInputOnlyText from '../inputs/CustomInputOnlyText';
import AutoSuggestInput from '../inputs/AutoSuggestInput';
import CustomInputPhone from '../inputs/CustomInputPhone';
import { format } from 'date-fns';
import { showNotification } from '../../utils/notificaction';
import ZipcodeAutocompleteRHF from '../inputs/ZipcodeAutocompleteRHF';
import { type LandingFormInput } from '../../utils/buildLandingPayload';
import { sendLeadToLanding } from '../../services/lead';
import { isValidPhoneNumber } from 'libphonenumber-js/max';
import { apiUrl } from '../../services/config';

interface FormValues {
  origin_city: string;
  destination_city: string;
  transport_type: string;
}

type Step1FormValues = FormValues & {
  origin_city__isValid: boolean;
  destination_city__isValid: boolean;
};

const validationSchemaStep1: yup.ObjectSchema<Step1FormValues> = yup.object({
  origin_city: yup
    .string()
    .required('Please provide a valid city or zip code.')
    .test('origin-selected', 'Please select a suggestion from the list.', function () {
      return this.parent?.origin_city__isValid === true;
    }),
  destination_city: yup
    .string()
    .required('Please provide a valid city or zip code.')
    .test('destination-selected', 'Please select a suggestion from the list.', function () {
      return this.parent?.destination_city__isValid === true;
    }),
  transport_type: yup.string().required('Transport type is required'),
  origin_city__isValid: yup.boolean().default(false),
  destination_city__isValid: yup.boolean().default(false),
}).required();

// Ensure origin and destination differ
validationSchemaStep1.test('different-origin-destination', 'El origen y el destino no pueden ser iguales', function (val) {
  if (!val) return true;
  const o = String((val as any).origin_city || '').trim().toLowerCase();
  const d = String((val as any).destination_city || '').trim().toLowerCase();
  if (!o || !d) return true;
  if (o === d) {
    return this.createError({ path: 'destination_city', message: 'El origen y el destino no pueden ser iguales' });
  }
  return true;
});


const Step1 = ({ setActiveStep, setDataSubmit, dataSubmit }: any) => {
  const methods = useForm<Step1FormValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: yupResolver<Step1FormValues>(validationSchemaStep1),
    defaultValues: {
      origin_city: dataSubmit.origin_city || '',
      destination_city: dataSubmit.destination_city || '',
      transport_type: dataSubmit.transport_type || '1',
      origin_city__isValid: false,
      destination_city__isValid: false,
    } satisfies Step1FormValues,
  });

  const { handleSubmit, trigger, formState: { errors }, control } = methods;

  const onSubmit = async (data: FormValues) => {
    const isValid = await trigger();
    if (!isValid) {
      return;
    }

    setDataSubmit((prevData: any) => ({
      ...prevData,
      ...data
    }));
    // Skip vehicle details step (removed) and go directly to contact
    setActiveStep(2);
  };

  return (
    <FormProvider {...methods}>
      <section id="paso1" className="w-full mt-4 flex flex-col items-center">
        <form onSubmit={handleSubmit(onSubmit)} className='w-[90%]'>
          <div className="flex flex-col mb-1 w-full relative bg-white p-4 border border-gray-200">


            <ZipcodeAutocompleteRHF
              fieldNames={{ value: "origin_city" }}
              label="Transport Vehicle FROM"
              placeholder="Miami, FL 33101"
            />
          </div>
          <div className="flex flex-col mb-1 w-full relative bg-white p-4 border border-gray-200">


            <ZipcodeAutocompleteRHF
              fieldNames={{ value: "destination_city" }}
              label="Transport Vehicle TO"
              placeholder="Alameda, CA 94501"
            />
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Transport Type</label>
            <div className="grid grid-cols-2 gap-3">
              <Controller name={'transport_type'} control={control} render={({ field }) => (
                <div>
                  <input {...field} type="radio" id="transport_open_small" value="1" checked={field.value === '1'} className="sr-only peer" />
                  <label htmlFor="transport_open_small" className="block text-center w-full py-2.5 px-3 rounded-lg border border-slate-300 cursor-pointer peer-checked:bg-sky-500 peer-checked:text-white peer-checked:border-sky-500 font-semibold transition-colors text-sm">Open</label>
                </div>
              )} />
              <Controller name={'transport_type'} control={control} render={({ field }) => (
                <div>
                  <input {...field} type="radio" id="transport_enclosed_small" value="2" checked={field.value === '2'} className="sr-only peer" />
                  <label htmlFor="transport_enclosed_small" className="block text-center w-full py-2.5 px-3 rounded-lg border border-slate-300 cursor-pointer peer-checked:bg-sky-500 peer-checked:text-white peer-checked:border-sky-500 font-semibold transition-colors text-sm">Enclosed</label>
                </div>
              )} />
            </div>
            {errors.transport_type && <p className="text-red-500 text-xs italic mt-1">{errors.transport_type.message}</p>}
          </div>
          <button
            type="submit"
            className="bg-btn-blue flex items-center hover:bg-btn-hover transition-colors duration-500 ease-in-out focus:outline-none justify-center cursor-pointer text-lg mb-4 w-full h-10 mt-5 text-white rounded-lg px-4 font-semibold"
          >
            Next: Contact Info
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </section>
    </FormProvider>
  );
};

// Vehicles step removed — forms no longer collect per-vehicle details.



// Step2 (vehicle details) removed: proceed directly from Location -> Contact

// removed unused helper separarCiudadYEstado

const Step3 = ({ dataSubmit, handleSubmitLeadAndEmail, setActiveStep, setDataSubmit }: any) => {
  const [disabled, setDisabled] = useState<boolean>(false)
  const validationSchema = yup.object().shape({
    first_name: yup.string()
      .required('Name is required')
      .matches(/^[a-zA-Z\s]+$/, 'Name must only contain letters and spaces')
      .min(3, 'Name must be at least 3 characters')
      .max(20, 'Name must be at most 20 characters'),
    phone: yup.string()
      .required('Phone is required')
      .test('valid-phone', 'Enter a valid phone number for the selected country.', (val) => {
        if (!val) return false;
        try {
          return isValidPhoneNumber(String(val));
        } catch {
          return false;
        }
      }),
    email: yup.string()
      .required('Email is required')
      .matches(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-z]{2,6}$/, 'Invalid e-mail format')
      .email('Email is not valid'),
    ship_date: yup.string()
      .required('Date is required')
      .test('is-valid-date', 'Date is required', value => value !== '' && !isNaN(Date.parse(value)))
  });

  const methods = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      first_name: dataSubmit.first_name || '',
      phone: dataSubmit.phone || '',
      email: dataSubmit.email || '',
      ship_date: dataSubmit.ship_date || '',
    },
  });

  const { handleSubmit } = methods;

  const originCityAndState = dataSubmit?.origin_city;

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return format(dateObj, 'MM/dd/yyyy');
  };
  const onSubmit = (data: any) => {
    setDisabled(true)
    const formattedDate = formatDate(data.ship_date);

    const dataToSend = {
      ...dataSubmit,
      ...data,
      AuthKey: "f895aa95-10ea-41ae-984f-c123bf7e0ff0",
      ship_date: formattedDate
    };
    handleSubmitLeadAndEmail(dataToSend)
  };
  const handleStepBack = (step: number) => {
    const datavalue = methods.getValues()
    setDataSubmit(datavalue);
    setActiveStep(step);
  };

  // Inline Back uses handleStepBack(0) to return to Location step

  return (
    <FormProvider {...methods}>
      <section id="paso3" className={`form--quote--content mt-4 block max-w-[90%]`}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col mb-1 relative bg-white p-4 border border-gray-200">
            <CustomInputOnlyText name='first_name' max={20} type='text' label='Name' />
          </div>
          <div className="flex flex-col mb-1 relative bg-white p-4 border border-gray-200">
            <CustomInputPhone name='phone' type='text' max={14} label='Phone' defaultValue={methods.getValues('phone')}
            />
          </div>
          <div className="flex flex-col mb-1 relative bg-white p-4 border border-gray-200">
            <CustomInput name='email' max={30} label='Email' />
          </div>
          <div className="flex flex-col mb-1 relative bg-white p-4 border border-gray-200">
            <DateInput name='ship_date' label='Date' />
          </div>
          <div className="flex text-xs gap-4 py-2 border-b border-dashed">
            <small id="termsAndConditions">
              By providing your phone number/email and clicking through, you agree to Cayad Auto Transport's
              <a href="/pdfs/Terms-and-Conditions.pdf" className="text-btn-blue underline"> Terms </a>
              and <a href="/privacy-policy/" className="text-btn-blue underline"> Privacy Policy </a> , and authorize us to make or initiate sales calls, SMS, emails, and prerecorded voicemails to that number using an automated system. Message frequency may vary. Your agreement is not a condition of purchasing any products, goods, or services. You may opt out at any time by typing STOP. For help, type HELP. Message & data rates may apply."
            </small>
          </div>
          <div className="flex gap-3 items-stretch mt-4">
            <button
              type="button"
              onClick={() => handleStepBack(0)}
              className="w-32 sm:w-36 inline-flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              id="submit_button" disabled={disabled}
              className={`flex-1 bg-orange-600 hover:bg-orange-700 transition-colors duration-500 ease-in-out focus:outline-none flex items-center justify-center cursor-pointer h-10 text-white rounded-lg font-semibold
                ${disabled ? 'opacity-[0.6] hover:cursor-not-allowed ' : ''}
                `}
              type="submit"
            >
              {disabled
                ? <p className='mr-2'>Loading</p>
                : <p className='mr-2'>Request your Premium Quote</p>
              }
              <FaRegPaperPlane />
            </button>
          </div>
        </form>
        <footer className="flex justify-around text-center py-4">
          <div className="flex flex-col items-center" >
            <button type="button" onClick={() => { handleStepBack(0) }} className="bg-btn-blue text-center flex justify-center items-center text-white w-8 h-8 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <small>Location</small>
          </div>
          <div className="flex flex-col items-center" >
            <button type="button" onClick={() => { handleStepBack(1) }} className="bg-btn-blue flex justify-center items-center text-white w-8 h-8 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <small>Vehicle(s)</small>
          </div>
          <div className="flex flex-col items-center">
            <button type="button" className="border border-btn-blue text-btn-blue w-8 h-8 rounded-full">3</button>
            <small>Contact</small>
          </div>
        </footer>
      </section>
    </FormProvider>
  );
};

// Legacy helper removed: lead number is returned by sendLeadToLanding JSON response

const FormLanding = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [dataSubmit, setDataSubmit] = useState<any>({});
  const [disabled, setDisabled] = useState(false);

  const updateFormData = (newData: any) => {
    setDataSubmit((prevData: any) => ({
      ...prevData,
      ...newData,
    }));
  };

  const handleSubmitLead = async (data: LandingFormInput) => {
    try {
      setDisabled(true);

      // Phone comes already in E.164 format from CustomInputPhone
      const payload: LandingFormInput = { ...data };
      const resp = await sendLeadToLanding(payload);

      if (resp?.status === "success" && typeof resp.id !== "undefined") {
        saveNumberLead(String(resp.id));
        showNotification({ text: "Success!", icon: "success" });
        saveLead?.(payload as any);
        saveEmail?.({ ...(payload as any), crm_lead_id: resp.id });

        setTimeout(() => {
          window.location.href = "/quote2";
        }, 2000);
      } else {
        showNotification({ text: "Error sending quote", icon: "error" });
      }
    } catch (err) {
      showNotification({ text: "Error sending lead", icon: "error" });
    } finally {
      setDisabled(false);
    }
  };

  const renderContent = useCallback(() => {
    switch (activeStep) {
      case 1:
      case 2:
        // When vehicle step was removed we treat step 1/2 as the contact step
        return (
          <Step3
            disabled={disabled}
            dataSubmit={dataSubmit}
            setActiveStep={setActiveStep}
            handleSubmitLeadAndEmail={handleSubmitLead}
            setDataSubmit={updateFormData}
          />
        );
      default:
        return (
          <Step1
            setActiveStep={setActiveStep}
            dataSubmit={dataSubmit}
            setDataSubmit={setDataSubmit}
          />
        );
    }
  }, [activeStep, dataSubmit, disabled]);

  return (
    <div
      className="
        mx-auto mb-8 flex flex-col items-center justify-between
        overflow-auto rounded-lg bg-white min-h-96 max-h-[450px]
        w-[95%] sm:w-[90%] md:w-[60%] lg:w-[500px] max-w-[500px]
        border border-slate-200 shadow-lg
      "
    >
      {renderContent()}
    </div>
  );
};

export default FormLanding;





